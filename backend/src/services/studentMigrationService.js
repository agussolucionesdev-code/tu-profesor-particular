import crypto from "node:crypto";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import StudentMigrationRun from "../models/StudentMigrationRun.js";
import StudentMigrationDryRunObservation from "../models/StudentMigrationDryRunObservation.js";
import {
  classifyBookingIdentity,
  linkBookingToStudent,
  projectStudentCandidateFromBooking,
  recordStudentLinkFailure,
  STUDENT_IDENTITY_ALGORITHM_VERSION,
} from "./studentIdentityService.js";

const sameIdentityHashes = (left = [], right = []) => {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index]);
};

const rehydrateDryRunStudents = async (observations) => {
  if (!observations.length) return [];

  const bookings = await Booking.find({
    _id: { $in: observations.map(({ bookingId }) => bookingId) },
  });
  const byId = new Map(bookings.map((booking) => [String(booking._id), booking]));
  const virtualStudents = [];

  for (const observation of observations) {
    const booking = byId.get(String(observation.bookingId));
    if (
      !booking ||
      booking.deletedAt ||
      booking.studentId ||
      booking.studentLink?.status === "linked"
    ) {
      const error = new Error(
        `Dry-run source Booking state changed after observation: ${observation.bookingId}.`,
      );
      error.code = "STUDENT_DRY_RUN_SOURCE_DRIFT";
      throw error;
    }
    const candidate = projectStudentCandidateFromBooking(booking);
    if (!sameIdentityHashes(candidate.identityKeys, observation.identityHashes)) {
      const error = new Error(
        `Dry-run source Booking identity changed after observation: ${observation.bookingId}.`,
      );
      error.code = "STUDENT_DRY_RUN_IDENTITY_DRIFT";
      throw error;
    }
    if (observation.decision === "would-create") {
      virtualStudents.push(candidate);
    }
  }
  return virtualStudents;
};

const report = (run) => ({
  runId: run.runId,
  algorithmVersion: run.algorithmVersion,
  mode: run.mode,
  status: run.status,
  checkpoint: run.checkpoint?.toObject?.() || run.checkpoint,
  counts: {
    ...(run.counts?.toObject?.() || run.counts),
    errors: run.counts.errorCount,
  },
  createdStudentIds: run.createdStudentIds.map(String),
  linkedBookingIds: run.linkedBookingIds.map(String),
  errors: run.errorSamples.map((error) => ({
    bookingId: error.bookingId ? String(error.bookingId) : null,
    message: error.message,
  })),
  completedAt: run.completedAt,
  rolledBackAt: run.rolledBackAt,
});

export const migrateStudents = async ({
  apply = false,
  runId = crypto.randomUUID(),
  batchSize = 100,
} = {}) => {
  const mode = apply ? "apply" : "dry-run";
  const safeBatchSize = Math.min(Math.max(Number(batchSize) || 100, 1), 500);
  let virtualStudents = [];
  let run = await StudentMigrationRun.findOne({ runId });

  if (run) {
    if (run.mode !== mode || run.algorithmVersion !== STUDENT_IDENTITY_ALGORITHM_VERSION) {
      throw new Error("Migration runId cannot be reused with another mode or algorithm version.");
    }
    if (["completed", "completed-with-errors", "rolled-back"].includes(run.status)) {
      return report(run);
    }
  } else {
    run = await StudentMigrationRun.create({
      runId,
      algorithmVersion: STUDENT_IDENTITY_ALGORITHM_VERSION,
      mode,
      status: "running",
    });
  }

  // Recover the tiny crash window between the durable Booking/Student writes
  // and the run checkpoint. Provenance lives on the affected documents, so a
  // resumed run and its rollback never depend only on an in-memory batch.
  if (apply) {
    const [durableProgress, durableStudents] = await Promise.all([
      Booking.find({ "studentLink.runId": runId }).select("_id studentId studentLink.status").sort({ _id: 1 }).lean(),
      Student.find({ "migrationMetadata.createdByRunId": runId }).select("_id").lean(),
    ]);
    const durableLinks = durableProgress.filter(({ studentId }) => studentId);
    durableLinks.forEach(({ _id }) => run.linkedBookingIds.addToSet(_id));
    durableStudents.forEach(({ _id }) => run.createdStudentIds.addToSet(_id));
    run.counts.processed = Math.max(run.counts.processed, durableProgress.length);
    run.counts.linked = run.linkedBookingIds.length;
    run.counts.created = run.createdStudentIds.length;
    run.counts.reused = Math.max(0, run.counts.linked - run.counts.created);
    run.counts.reviewCandidates = durableProgress.filter(({ studentLink }) => studentLink?.status === "review").length;
    run.counts.errorCount = durableProgress.filter(({ studentLink }) => studentLink?.status === "failed").length;
    if (durableProgress.length) {
      run.checkpoint.lastBookingId = durableProgress.at(-1)._id;
      run.checkpoint.processed = run.counts.processed;
    }
    await run.save();
  } else {
    const observations = await StudentMigrationDryRunObservation.find({ runId })
      .sort({ bookingId: 1 })
      .lean();
    run.counts.processed = observations.length;
    run.counts.wouldCreate = observations.filter(({ decision }) => decision === "would-create").length;
    run.counts.wouldLink = observations.filter(({ decision }) => decision === "would-link").length;
    run.counts.reviewCandidates = observations.filter(({ hasReviewCandidates }) => hasReviewCandidates).length;
    virtualStudents = await rehydrateDryRunStudents(observations);
    if (observations.length) {
      run.checkpoint.lastBookingId = observations.at(-1).bookingId;
      run.checkpoint.processed = observations.length;
    }
    await run.save();
  }

  while (true) {
    const query = {
      deletedAt: null,
      $or: [{ studentId: null }, { studentId: { $exists: false } }],
      ...(run.checkpoint.lastBookingId ? { _id: { $gt: run.checkpoint.lastBookingId } } : {}),
    };
    const bookings = await Booking.find(query).sort({ _id: 1 }).limit(safeBatchSize);
    if (!bookings.length) break;

    for (const booking of bookings) {
      try {
        if (!apply) {
          const classification = await classifyBookingIdentity(booking, {
            additionalCandidates: virtualStudents,
          });
          const identityHashes = classification.identity.identityKeys.slice().sort();
          const decision = classification.classification === "review"
            ? "review"
            : classification.exactStudent
              ? "would-link"
              : "would-create";
          const observation = await StudentMigrationDryRunObservation.findOneAndUpdate(
            { runId, bookingId: booking._id },
            { $setOnInsert: {
              identityHashes,
              decision,
              hasReviewCandidates: classification.reviewCandidateIds.length > 0,
            } },
            { upsert: true, new: true },
          );
          if (observation.decision === "would-link") run.counts.wouldLink += 1;
          if (observation.decision === "would-create") run.counts.wouldCreate += 1;
          if (observation.hasReviewCandidates) run.counts.reviewCandidates += 1;
          if (observation.decision === "would-create") {
            virtualStudents.push(projectStudentCandidateFromBooking(booking));
          }
        } else {
          const result = await linkBookingToStudent(booking, { source: "migration", runId });
          if (result.status === "linked") {
            if (result.needsReview) run.counts.reviewCandidates += 1;
            if (
              result.created ||
              result.student?.migrationMetadata?.createdByRunId === runId
            ) {
              run.createdStudentIds.addToSet(result.student._id);
            }
            run.linkedBookingIds.addToSet(booking._id);
            run.counts.linked = run.linkedBookingIds.length;
            run.counts.created = run.createdStudentIds.length;
            run.counts.reused = Math.max(0, run.counts.linked - run.counts.created);
          } else {
            run.counts.reviewCandidates += 1;
          }
        }
      } catch (error) {
        run.counts.errorCount += 1;
        if (run.errorSamples.length < 100) {
          run.errorSamples.push({ bookingId: booking._id, message: error.message.slice(0, 300) });
        }
        if (apply) {
          await recordStudentLinkFailure({
            bookingId: booking._id,
            source: "migration",
            runId,
            error,
          });
        }
      } finally {
        run.counts.processed += 1;
        run.checkpoint.lastBookingId = booking._id;
        run.checkpoint.processed = run.counts.processed;
        // Per-document checkpoints favor exact recovery over migration speed.
        await run.save();
      }
    }
  }

  run.status = run.counts.errorCount ? "completed-with-errors" : "completed";
  run.completedAt = new Date();
  await run.save();
  return report(run);
};

export const rollbackStudentMigration = async ({ runId } = {}) => {
  if (!runId) throw new Error("runId is required to rollback a Student migration.");
  const run = await StudentMigrationRun.findOne({ runId });
  if (!run || run.mode !== "apply") {
    throw new Error("Applied Student migration run not found.");
  }
  if (run.status === "rolled-back") return report(run);
  if (!run.completedAt) throw new Error("A running migration cannot be rolled back.");

  const durableLinks = await Booking.find({ "studentLink.runId": runId }).select("_id").lean();
  const linkIds = new Set([
    ...run.linkedBookingIds.map(String),
    ...durableLinks.map(({ _id }) => String(_id)),
  ]);
  [...linkIds].forEach((bookingId) => run.linkedBookingIds.addToSet(bookingId));
  let rolledBackLinks = 0;
  for (const bookingId of linkIds) {
    const result = await Booking.updateOne(
      { _id: bookingId, "studentLink.runId": runId },
      { $unset: { studentId: "", studentLink: "" } },
    );
    rolledBackLinks += result.modifiedCount;
  }

  const durableStudents = await Student.find({
    "migrationMetadata.createdByRunId": runId,
  }).select("_id").lean();
  const studentIds = new Set([
    ...run.createdStudentIds.map(String),
    ...durableStudents.map(({ _id }) => String(_id)),
  ]);
  [...studentIds].forEach((studentId) => run.createdStudentIds.addToSet(studentId));
  // Persist the complete rollback inventory before mutating any target. A
  // restart can then derive cumulative progress even when the prior process
  // died immediately after a successful delete/unlink.
  await run.save();
  let rolledBackStudents = 0;
  for (const studentId of studentIds) {
    const referenced = await Booking.exists({ studentId });
    if (referenced) continue;
    const result = await Student.deleteOne({
      _id: studentId,
      "migrationMetadata.createdByRunId": runId,
    });
    rolledBackStudents += result.deletedCount;
  }

  const [remainingLinks, remainingStudents] = await Promise.all([
    Booking.countDocuments({ _id: { $in: run.linkedBookingIds }, "studentLink.runId": runId }),
    Student.countDocuments({ _id: { $in: run.createdStudentIds }, "migrationMetadata.createdByRunId": runId }),
  ]);
  run.counts.rolledBackLinks = run.linkedBookingIds.length - remainingLinks;
  run.counts.rolledBackStudents = run.createdStudentIds.length - remainingStudents;
  run.status = "rolled-back";
  run.rolledBackAt = new Date();
  await run.save();
  return report(run);
};
