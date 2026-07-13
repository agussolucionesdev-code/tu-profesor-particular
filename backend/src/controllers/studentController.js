import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import { normalizeIdentityText } from "../services/studentIdentityService.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paginationFrom = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit };
};

const scopeFilter = (query) => {
  const scope = String(query.scope || "active").toLowerCase();
  if (scope === "all" || query.includeDeleted === "true") return {};
  if (scope === "deleted") return { deletedAt: { $type: "date" } };
  return { deletedAt: null, active: true };
};

const metricsFor = async (studentIds) => {
  if (!studentIds.length) return new Map();
  const now = new Date();
  const [rows, futureRows] = await Promise.all([
    Booking.aggregate([
      { $match: { studentId: { $in: studentIds }, deletedAt: null } },
      { $group: {
        _id: "$studentId",
        bookingsCount: { $sum: 1 },
        lastBookingAt: {
          $max: { $cond: [{ $lt: ["$timeSlot", now] }, "$timeSlot", null] },
        },
      } },
    ]),
    Booking.aggregate([
      { $match: {
        studentId: { $in: studentIds },
        deletedAt: null,
        timeSlot: { $gte: now },
        status: { $nin: ["Cancelado", "Finalizado"] },
      } },
      { $group: { _id: "$studentId", nextBookingAt: { $min: "$timeSlot" } } },
    ]),
  ]);
  const futureByStudent = new Map(futureRows.map((row) => [String(row._id), row.nextBookingAt]));
  return new Map(rows.map((row) => [String(row._id), {
    bookingsCount: row.bookingsCount,
    lastBookingAt: row.lastBookingAt,
    nextBookingAt: futureByStudent.get(String(row._id)) || null,
  }]));
};

const emptyMetrics = () => ({ bookingsCount: 0, lastBookingAt: null, nextBookingAt: null });

const studentDto = (student, metrics = emptyMetrics(), { detail = false } = {}) => {
  const source = typeof student.toObject === "function" ? student.toObject() : student;
  const dto = {
    id: String(source._id),
    displayName: source.displayName,
    studentType: source.studentType,
    contact: source.contact,
    responsible: source.responsible,
    academic: source.academic,
    aliases: source.aliases || [],
    active: source.active,
    deletedAt: source.deletedAt,
    metrics,
  };
  if (detail) {
    Object.assign(dto, {
      source: source.source,
      migrationMetadata: source.migrationMetadata,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
  }
  return dto;
};

export const getStudents = async (req, res, next) => {
  try {
    const { page, limit } = paginationFrom(req.query);
    const filter = scopeFilter(req.query);
    const normalizedSearch = normalizeIdentityText(req.query.search);
    if (normalizedSearch) {
      const pattern = new RegExp(escapeRegex(normalizedSearch), "i");
      const phoneSearch = String(req.query.search).replace(/\D/g, "");
      filter.$or = [
        { normalizedName: pattern },
        { "responsible.normalizedName": pattern },
        { "contact.email": pattern },
        ...(phoneSearch ? [{ "contact.phoneDigits": new RegExp(escapeRegex(phoneSearch)) }] : []),
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(mongoose.trusted(filter))
        .sort({ normalizedName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(mongoose.trusted(filter)),
    ]);
    const metrics = await metricsFor(students.map((student) => student._id));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      data: students.map((student) => studentDto(student, metrics.get(String(student._id)) || emptyMetrics())),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStudentById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Identificador de alumno inválido.",
        requestId: req.requestId,
      });
    }
    const student = await Student.findOne(mongoose.trusted({
      _id: req.params.id,
      ...scopeFilter(req.query),
    })).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Alumno no encontrado.",
        requestId: req.requestId,
      });
    }

    const [metrics, recentBookings] = await Promise.all([
      metricsFor([student._id]),
      Booking.find({ studentId: student._id, deletedAt: null })
        .select("bookingCode timeSlot endTime duration status subject educationLevel yearGrade school")
        .sort({ timeSlot: -1 })
        .limit(25)
        .lean(),
    ]);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      data: {
        student: studentDto(student, metrics.get(String(student._id)) || emptyMetrics(), { detail: true }),
        metrics: metrics.get(String(student._id)) || emptyMetrics(),
        recentBookings: recentBookings.map((booking) => ({
          id: String(booking._id),
          bookingCode: booking.bookingCode,
          timeSlot: booking.timeSlot,
          endTime: booking.endTime,
          duration: booking.duration,
          status: booking.status,
          subject: booking.subject,
          educationLevel: booking.educationLevel,
          yearGrade: booking.yearGrade,
          school: booking.school,
        })),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
