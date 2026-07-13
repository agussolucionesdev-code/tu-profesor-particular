import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import StudentIdentityEvent from "../models/StudentIdentityEvent.js";
import { normalizeEmail, normalizePhoneDigits } from "../utils/bookingRules.js";

export const STUDENT_IDENTITY_ALGORITHM_VERSION = "student-identity-v2";

export const normalizeIdentityText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const identityHash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const relationshipIdentity = (booking) => {
  const relationship = normalizeIdentityText(booking.responsibleRelationship);
  if (relationship !== "otro") return relationship;
  return `otro:${normalizeIdentityText(booking.responsibleRelationshipOther)}`;
};

const contactTokens = (booking) => {
  const email = normalizeEmail(booking.email);
  const phoneDigits = normalizePhoneDigits(booking.phone);
  return [
    ...(email ? [`email:${email}`] : []),
    ...(phoneDigits ? [`phone:${phoneDigits}`] : []),
  ];
};

export const buildStudentIdentity = (booking) => {
  const normalizedName = normalizeIdentityText(booking.studentName);
  const studentType = normalizeIdentityText(booking.responsibleRelationship) === "self"
    ? "adult"
    : "minor";
  const responsibleNormalizedName = studentType === "adult"
    ? normalizedName
    : normalizeIdentityText(booking.responsibleName);
  const relationship = studentType === "adult" ? "self" : relationshipIdentity(booking);
  const tokens = contactTokens(booking);
  if (!normalizedName || !responsibleNormalizedName || tokens.length === 0) {
    throw new Error("Booking does not contain enough identity data to link a Student.");
  }

  const identityPrefix = studentType === "adult"
    ? [studentType, normalizedName]
    : [studentType, normalizedName, responsibleNormalizedName, relationship];
  const identityKeys = tokens.map((token) => identityHash([...identityPrefix, token].join("|")));

  return {
    normalizedName,
    studentType,
    responsibleNormalizedName,
    relationship,
    identityKeys,
    email: normalizeEmail(booking.email),
    phoneDigits: normalizePhoneDigits(booking.phone),
  };
};

const editDistance = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[right.length];
};

const candidateId = (candidate) => candidate?._id || candidate?.id;

const sharesIdentityKey = (identity, candidate) => {
  const candidateKeys = Array.isArray(candidate?.identityKeys) ? candidate.identityKeys : [];
  return identity.identityKeys.some((key) => candidateKeys.includes(key));
};

const sharesContact = (identity, candidate) => {
  const aliases = Array.isArray(candidate?.contactAliases) ? candidate.contactAliases : [];
  const emails = [candidate?.contact?.email, ...aliases.map(({ email }) => email)].filter(Boolean);
  const phones = [
    candidate?.contact?.phoneDigits,
    ...aliases.map(({ phoneDigits }) => phoneDigits),
  ].filter(Boolean);
  return Boolean(
    (identity.email && emails.includes(identity.email)) ||
    (identity.phoneDigits && phones.includes(identity.phoneDigits)),
  );
};

export const isStudentReviewCandidate = (identity, candidate) => {
  if (!candidate || candidate.studentType !== identity.studentType) return false;
  if (candidate.normalizedName === identity.normalizedName) return true;
  if (!sharesContact(identity, candidate)) return false;
  if (editDistance(candidate.normalizedName || "", identity.normalizedName) > 2) return false;
  if (identity.studentType === "adult") return true;
  return candidate.responsible?.normalizedName === identity.responsibleNormalizedName &&
    normalizeIdentityText(candidate.responsible?.relationship) ===
      normalizeIdentityText(identity.relationship).split(":")[0];
};

export const classifyStudentIdentityCandidates = (identity, candidates = []) => {
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = String(candidateId(candidate) || candidate?.identityKeys?.join("|") || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  const exact = unique.filter((candidate) => sharesIdentityKey(identity, candidate));
  if (exact.length > 1) {
    return { classification: "review", exactStudent: null, reviewCandidates: exact.slice(0, 10) };
  }
  if (exact.length === 1) {
    return { classification: "exact", exactStudent: exact[0], reviewCandidates: [] };
  }

  const reviewCandidates = unique.filter(
    (candidate) => isStudentReviewCandidate(identity, candidate),
  ).slice(0, 10);
  return {
    classification: reviewCandidates.length ? "new-with-review-candidates" : "new",
    exactStudent: null,
    reviewCandidates,
  };
};

export const projectStudentCandidateFromBooking = (booking) => {
  const identity = buildStudentIdentity(booking);
  return {
    _id: booking._id,
    identityKeys: identity.identityKeys,
    normalizedName: identity.normalizedName,
    studentType: identity.studentType,
    responsible: {
      normalizedName: identity.responsibleNormalizedName,
      relationship: normalizeIdentityText(booking.responsibleRelationship),
    },
    contact: {
      email: identity.email,
      phoneDigits: identity.phoneDigits,
    },
    contactAliases: [],
  };
};

const findReviewCandidatePool = async (identity, excludedIds = []) => {
  const contactOr = [
    ...(identity.email ? [{ "contact.email": identity.email }, { "contactAliases.email": identity.email }] : []),
    ...(identity.phoneDigits ? [{ "contact.phoneDigits": identity.phoneDigits }, { "contactAliases.phoneDigits": identity.phoneDigits }] : []),
  ];
  const candidates = await Student.find({
    _id: { $nin: excludedIds },
    deletedAt: null,
    studentType: identity.studentType,
    $or: [{ normalizedName: identity.normalizedName }, ...contactOr],
  }).select("_id normalizedName studentType responsible contact contactAliases").limit(50).lean();

  return candidates;
};

export const classifyBookingIdentity = async (booking, { additionalCandidates = [] } = {}) => {
  const identity = buildStudentIdentity(booking);
  const exact = await Student.find({
    deletedAt: null,
    identityKeys: { $in: identity.identityKeys },
  }).limit(2);
  let classified = classifyStudentIdentityCandidates(identity, [
    ...exact,
    ...additionalCandidates,
  ]);
  if (classified.classification === "new") {
    const reviewCandidates = await findReviewCandidatePool(identity);
    classified = classifyStudentIdentityCandidates(identity, [
      ...reviewCandidates,
      ...additionalCandidates,
    ]);
  }
  return {
    identity,
    exactStudent: classified.exactStudent,
    reviewCandidateIds: classified.reviewCandidates.map(candidateId),
    classification: classified.classification,
  };
};

const studentFromBooking = (booking, identity, context) => ({
  displayName: booking.studentName,
  normalizedName: identity.normalizedName,
  studentType: identity.studentType,
  responsible: {
    name: identity.studentType === "adult" ? booking.studentName : booking.responsibleName,
    normalizedName: identity.responsibleNormalizedName,
    relationship: identity.studentType === "adult"
      ? "self"
      : normalizeIdentityText(booking.responsibleRelationship),
    relationshipOther: booking.responsibleRelationshipOther || "",
  },
  contact: {
    email: identity.email,
    phone: booking.phone || "",
    phoneDigits: identity.phoneDigits,
  },
  contactAliases: [{
    email: identity.email,
    phone: booking.phone || "",
    phoneDigits: identity.phoneDigits,
    observedAt: booking.createdAt || new Date(),
  }],
  academic: {
    school: booking.school || "",
    educationLevel: booking.educationLevel || "",
    yearGrade: booking.yearGrade || "",
    subjects: booking.subject ? [booking.subject] : [],
  },
  aliases: [{
    displayName: booking.studentName,
    responsibleName: booking.responsibleName,
    sourceBookingId: booking._id,
    observedAt: new Date(),
  }],
  identityKeys: identity.identityKeys,
  source: context.source === "migration" ? "migration" : "booking",
  migrationMetadata: {
    createdByRunId: context.runId || null,
    algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
    sourceBookingId: booking._id,
  },
});

const writeIdentityEvent = (event) => StudentIdentityEvent.create({
  ...event,
  algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
}).catch((error) => {
  console.error("[student-identity-audit]", {
    bookingId: String(event.bookingId),
    outcome: event.outcome,
    error: error.message,
  });
});

export const recordStudentLinkFailure = async ({ bookingId, source = "booking", runId, error }) => {
  const errorCode = String(error?.code || error?.name || "STUDENT_LINK_FAILED").slice(0, 80);
  await Booking.updateOne(
    { _id: bookingId, studentId: null },
    { $set: { studentLink: {
      status: "failed",
      source,
      runId: runId || null,
      algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
      lastAttemptAt: new Date(),
      linkedAt: null,
      candidateIds: [],
      errorCode,
    } } },
  ).catch(() => {});
  await writeIdentityEvent({
    bookingId,
    outcome: "failed",
    source,
    runId: runId || null,
    reason: errorCode,
  });
};

export const linkBookingToStudent = async (bookingOrId, context = {}) => {
  const source = context.source || "booking";
  const booking = bookingOrId?._id
    ? bookingOrId
    : await Booking.findById(bookingOrId);
  if (!booking) throw new Error("Booking not found while linking Student.");

  if (booking.studentId) {
    const existingStudent = await Student.findById(booking.studentId);
    if (existingStudent) {
      await writeIdentityEvent({
        bookingId: booking._id,
        studentId: existingStudent._id,
        outcome: "already-linked",
        source,
        runId: context.runId || null,
      });
      return { status: "linked", student: existingStudent, created: false, reviewCandidateIds: [] };
    }
  }

  const classification = await classifyBookingIdentity(booking);
  const linkFilter = {
    _id: booking._id,
    deletedAt: null,
    $or: [{ studentId: null }, { studentId: { $exists: false } }],
    ...(context.leaseId ? { "studentLink.leaseId": context.leaseId } : {}),
  };
  if (classification.classification === "review") {
    await Booking.updateOne(linkFilter, {
      $set: { studentLink: {
        status: "review",
        source,
        runId: context.runId || null,
        algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
        lastAttemptAt: new Date(),
        linkedAt: null,
        candidateIds: classification.reviewCandidateIds,
        errorCode: "AMBIGUOUS_EXACT_IDENTITY",
      } },
    });
    await writeIdentityEvent({
      bookingId: booking._id,
      outcome: "review",
      source,
      runId: context.runId || null,
      candidateIds: classification.reviewCandidateIds,
      reason: "AMBIGUOUS_EXACT_IDENTITY",
    });
    return { status: "review", student: null, created: false, ...classification };
  }

  let student = classification.exactStudent;
  let created = false;
  if (!student) {
    try {
      student = await Student.create(studentFromBooking(booking, classification.identity, {
        source,
        runId: context.runId,
      }));
      created = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      student = await Student.findOne({
        deletedAt: null,
        identityKeys: { $in: classification.identity.identityKeys },
      });
      if (!student) throw error;
    }
  } else if (source !== "migration") {
    const missingKeys = classification.identity.identityKeys.filter(
      (key) => !student.identityKeys.includes(key),
    );
    const collisions = missingKeys.length
      ? await Student.find({
        _id: { $ne: student._id },
        deletedAt: null,
        identityKeys: { $in: missingKeys },
      }).select("_id").lean()
      : [];
    if (collisions.length) {
      classification.reviewCandidateIds.push(...collisions.map(({ _id }) => _id));
    } else {
      await Student.updateOne(
        { _id: student._id },
        {
          $addToSet: {
            identityKeys: { $each: missingKeys },
            ...(booking.subject ? { "academic.subjects": booking.subject } : {}),
            aliases: {
              displayName: booking.studentName,
              responsibleName: booking.responsibleName,
              sourceBookingId: booking._id,
              observedAt: booking.createdAt || new Date(),
            },
            contactAliases: {
              email: classification.identity.email,
              phone: booking.phone || "",
              phoneDigits: classification.identity.phoneDigits,
              observedAt: booking.createdAt || new Date(),
            },
          },
        },
      );
      student = await Student.findById(student._id);
    }
  }

  try {
    const linkedAt = new Date();
    const needsReview = classification.reviewCandidateIds.length > 0;
    const update = await Booking.updateOne(
      linkFilter,
      { $set: {
        studentId: student._id,
        studentLink: {
          status: needsReview ? "review" : "linked",
          source,
          runId: context.runId || null,
          algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
          linkedAt,
          lastAttemptAt: linkedAt,
          candidateIds: classification.reviewCandidateIds,
          errorCode: "",
        },
      } },
    );

    if (!update.modifiedCount) {
      const winner = await Booking.findById(booking._id).select("studentId");
      if (winner?.studentId && String(winner.studentId) !== String(student._id)) {
        if (created && !(await Booking.exists({ studentId: student._id }))) {
          await Student.deleteOne({ _id: student._id });
        }
        student = await Student.findById(winner.studentId);
        created = false;
      } else if (context.leaseId) {
        if (created && !(await Booking.exists({ studentId: student._id }))) {
          await Student.deleteOne({ _id: student._id });
        }
        const leaseError = new Error("Student link lease was lost before commit.");
        leaseError.code = "STUDENT_LINK_LEASE_LOST";
        throw leaseError;
      }
    }
  } catch (error) {
    if (created && !(await Booking.exists({ studentId: student._id }))) {
      await Student.deleteOne({ _id: student._id }).catch(() => {});
    }
    throw error;
  }

  await writeIdentityEvent({
    bookingId: booking._id,
    studentId: student._id,
    outcome: classification.reviewCandidateIds.length ? "review" : "linked",
    source,
    runId: context.runId || null,
    candidateIds: classification.reviewCandidateIds,
  });

  return {
    status: "linked",
    student,
    created,
    reviewCandidateIds: classification.reviewCandidateIds,
    needsReview: classification.reviewCandidateIds.length > 0,
  };
};
