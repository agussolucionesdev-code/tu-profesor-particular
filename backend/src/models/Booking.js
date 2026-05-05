import crypto from "node:crypto";
import mongoose from "mongoose";
import {
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

    price: { type: Number, default: 0, min: 0, max: 99999999 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    studentEvolution: { type: String, trim: true, default: "", maxlength: 5000 },
    emotionalState: { type: String, trim: true, default: "", maxlength: 1000 },

    bookingCode: {
      type: String,
      unique: true,
      uppercase: true,
      immutable: true,
      minlength: 6,
      maxlength: 12,
      set: normalizeCode,
    },

    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: "Pendiente",
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
bookingSchema.index({ email: 1 });
bookingSchema.index({ phone: 1 });

bookingSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
