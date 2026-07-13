import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  ATTENDANCE_STATUS,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  RESPONSIBLE_RELATIONSHIP_VALUES,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
} from "../utils/bookingRules.js";

const BOOKING_STATUS = ["Confirmado", "Pendiente", "Cancelado", "Finalizado"];
const BOOKING_CODE_CHARACTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const BOOKING_CODE_LENGTH = 6;

const hasValidPhoneDigits = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

const generateBookingCode = () =>
  Array.from({ length: BOOKING_CODE_LENGTH }, () =>
    BOOKING_CODE_CHARACTERS.charAt(
      crypto.randomInt(0, BOOKING_CODE_CHARACTERS.length),
    ),
  ).join("");

const bookingSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    responsibleName: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    responsibleRelationship: {
      type: String,
      enum: RESPONSIBLE_RELATIONSHIP_VALUES,
      required: true,
      default: "self",
    },
    responsibleRelationshipOther: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    tutorName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      default: "Agustin",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
      set: normalizePhone,
      validate: {
        validator: (value) => !value || hasValidPhoneDigits(value),
        message: "El teléfono debe tener entre 8 y 15 dígitos.",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 160,
      set: normalizeEmail,
      validate: {
        validator: (value) => !value || looksLikeEmail(value),
        message: "El email ingresado no es válido.",
      },
    },

    school: { type: String, trim: true, default: "", maxlength: 120 },
    educationLevel: { type: String, required: true, trim: true, maxlength: 60 },
    yearGrade: { type: String, required: true, trim: true, maxlength: 60 },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    academicSituation: { type: String, trim: true, default: "", maxlength: 1200 },

    timeSlot: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    duration: { type: Number, required: true, default: 1, min: 0.5, max: 10 },
    // Frozen scheduling buffers keep historical slot claims stable even when
    // the global availability policy changes later.
    bufferBeforeMinutes: { type: Number, default: 0, min: 0, max: 240 },
    bufferAfterMinutes: { type: Number, default: 0, min: 0, max: 240 },

    price: { type: Number, default: 0, min: 0, max: 99999999 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    studentNotes: { type: String, trim: true, default: "", maxlength: 500 },
    studentEvolution: { type: String, trim: true, default: "", maxlength: 5000 },
    emotionalState: { type: String, trim: true, default: "", maxlength: 1000 },
    notesHistory: {
      type: [
        {
          field: { type: String, enum: ["notes", "studentEvolution", "emotionalState"] },
          text: { type: String, maxlength: 5000 },
          savedAt: { type: Date, default: Date.now },
          _id: false,
        },
      ],
      default: [],
    },

    bookingCode: {
      type: String,
      unique: true,
      uppercase: true,
      immutable: true,
      minlength: 6,
      maxlength: 12,
      set: normalizeCode,
    },

    managementTokenHash: {
      type: String,
      select: false,
      minlength: 64,
      maxlength: 64,
    },
    managementTokenExpiresAt: { type: Date, default: null },
    managementTokenRevokedAt: { type: Date, default: null },
    managementLinkLastSentAt: { type: Date, default: null, select: false },

    // Short-lived ownership lock for operations that need to replace multiple
    // BookingSlot documents without allowing another reprogramming request to
    // release claims it did not create.
    slotMutationLock: { type: String, default: null, select: false },
    slotMutationLockExpiresAt: { type: Date, default: null, select: false },

    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: "Pendiente",
    },
    attendanceStatus: {
      type: String,
      enum: ATTENDANCE_STATUS,
      default: "Sin registrar",
    },
    attendanceRecordedAt: { type: Date, default: null },
    attendanceNotes: { type: String, trim: true, default: "", maxlength: 1000 },
    attendanceUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // The original identity/contact fields above are an immutable historical
    // snapshot. Student updates never cascade back into a Booking.
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    studentLink: {
      type: new mongoose.Schema(
        {
          status: {
            type: String,
            enum: ["pending", "linked", "review", "failed"],
            required: true,
          },
          source: { type: String, enum: ["booking", "migration", "repair"], required: true },
          algorithmVersion: { type: String, required: true, maxlength: 40 },
          runId: { type: String, trim: true, default: null, maxlength: 100 },
          linkedAt: { type: Date, default: null },
          lastAttemptAt: { type: Date, required: true },
          candidateIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
          errorCode: { type: String, trim: true, default: "", maxlength: 80 },
          attempts: { type: Number, default: 0, min: 0 },
          nextAttemptAt: { type: Date, default: Date.now },
          leaseId: { type: String, default: null, maxlength: 80 },
          leaseExpiresAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

bookingSchema.pre("validate", async function validateBookingDocument() {
  if (this.responsibleRelationship !== RESPONSIBLE_RELATIONSHIP_OTHER_VALUE) {
    this.responsibleRelationshipOther = "";
  }

  if (!this.email && !this.phone) {
    this.invalidate(
      "phone",
      "Debes ingresar al menos un método de contacto: email o teléfono.",
    );
  }

  if (
    this.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE &&
    this.responsibleRelationshipOther.trim().length < 3
  ) {
    this.invalidate(
      "responsibleRelationshipOther",
      "Debes indicar cuál es el vínculo cuando eliges Otro.",
    );
  }

  if (this.timeSlot && this.endTime && this.endTime <= this.timeSlot) {
    this.invalidate("endTime", "La finalización del turno debe ser posterior al inicio.");
  }

  if (!this.isNew || this.bookingCode) {
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateBookingCode();
    const exists = await this.constructor.exists({ bookingCode: candidate });

    if (!exists) {
      this.bookingCode = candidate;
      return;
    }
  }

  throw new Error("No se pudo generar un código de reserva único.");
});

bookingSchema.index({ timeSlot: 1, status: 1 });
bookingSchema.index({ status: 1, timeSlot: 1, endTime: 1 }); // for hasConflict + getAvailability
bookingSchema.index({ deletedAt: 1, timeSlot: -1 });
bookingSchema.index({ email: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ studentId: 1, timeSlot: -1 });
bookingSchema.index({ "studentLink.runId": 1 });
bookingSchema.index(
  { managementTokenHash: 1 },
  { unique: true, sparse: true },
);

bookingSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
