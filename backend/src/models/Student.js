import mongoose from "mongoose";
import { normalizeEmail, normalizePhone } from "../utils/bookingRules.js";

const normalizeIdentityText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

const aliasSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, maxlength: 80 },
    responsibleName: { type: String, trim: true, maxlength: 80, default: "" },
    sourceBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    observedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const studentSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    normalizedName: { type: String, required: true, trim: true, maxlength: 80 },
    studentType: { type: String, enum: ["adult", "minor"], required: true },
    responsible: {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      normalizedName: { type: String, required: true, trim: true, maxlength: 80 },
      relationship: { type: String, required: true, trim: true, maxlength: 40 },
      relationshipOther: { type: String, trim: true, default: "", maxlength: 80 },
    },
    contact: {
      email: { type: String, trim: true, lowercase: true, default: "", set: normalizeEmail },
      phone: { type: String, trim: true, default: "", maxlength: 30, set: normalizePhone },
      phoneDigits: { type: String, trim: true, default: "", maxlength: 15 },
    },
    contactAliases: {
      type: [{
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        phoneDigits: { type: String, default: "" },
        observedAt: { type: Date, default: Date.now },
        _id: false,
      }],
      default: [],
    },
    academic: {
      school: { type: String, trim: true, default: "", maxlength: 120 },
      educationLevel: { type: String, trim: true, default: "", maxlength: 60 },
      yearGrade: { type: String, trim: true, default: "", maxlength: 60 },
      subjects: { type: [String], default: [] },
    },
    aliases: { type: [aliasSchema], default: [] },
    identityKeys: {
      type: [String],
      required: true,
      validate: {
        validator: (keys) => Array.isArray(keys) && keys.length > 0,
        message: "Student identity requires at least one conservative key.",
      },
    },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    source: {
      type: String,
      enum: ["booking", "admin", "migration"],
      required: true,
      default: "booking",
    },
    migrationMetadata: {
      createdByRunId: { type: String, trim: true, default: null, maxlength: 100 },
      algorithmVersion: { type: String, trim: true, default: null, maxlength: 40 },
      sourceBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    },
  },
  { timestamps: true, versionKey: false },
);

studentSchema.pre("validate", function normalizeStudentIdentityFields() {
  this.normalizedName = normalizeIdentityText(this.normalizedName || this.displayName);
  this.responsible.normalizedName = normalizeIdentityText(
    this.responsible.normalizedName || this.responsible.name,
  );
});

studentSchema.index(
  { identityKeys: 1 },
  {
    unique: true,
    name: "identityKeys_1",
    partialFilterExpression: { deletedAt: null },
  },
);
studentSchema.index({ deletedAt: 1, normalizedName: 1 }, { name: "deletedAt_1_normalizedName_1" });
studentSchema.index({ "contact.email": 1 }, { name: "contact.email_1" });
studentSchema.index({ "contact.phoneDigits": 1 }, { name: "contact.phoneDigits_1" });
studentSchema.index({ "responsible.normalizedName": 1 }, { name: "responsible.normalizedName_1" });

const sanitizeStudentSerialization = (_doc, ret) => {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.identityKeys;
  delete ret.migrationMetadata;
  delete ret.normalizedName;
  if (ret.responsible) delete ret.responsible.normalizedName;
  if (ret.contact) delete ret.contact.phoneDigits;
  if (Array.isArray(ret.contactAliases)) {
    ret.contactAliases.forEach((contact) => delete contact.phoneDigits);
  }
  return ret;
};

studentSchema.set("toJSON", { transform: sanitizeStudentSerialization });
studentSchema.set("toObject", { transform: sanitizeStudentSerialization });

const Student = mongoose.model("Student", studentSchema);
export default Student;
