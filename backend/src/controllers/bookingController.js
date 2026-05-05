import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { sendBookingNotifications } from "../config/mailer.js";
import {
  appendBookingToSheet,
  deleteBookingFromSheet,
  resetBookingSheet,
  updateBookingInSheet,
} from "../services/sheetsService.js";
import {
  availabilityQuerySchema,
  cancelSchema,
  createBookingSchema,
  getDefaultAvailabilityRange,
  looksLikeEmail,
  looksLikePhone,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
  parseDateTimeInput,
  phoneDigitsRegex,
  rescheduleSchema,
  updateBookingSchema,
  validateContact,
  validateSlot,
} from "../utils/bookingRules.js";

const activeStatusFilter = { status: { $ne: "Cancelado" } };
const MAX_AVAILABILITY_RANGE_DAYS = Number(
  process.env.MAX_AVAILABILITY_RANGE_DAYS || 120,
);
const MAX_AVAILABILITY_RANGE_MS =
  MAX_AVAILABILITY_RANGE_DAYS * 24 * 60 * 60 * 1000;

const publicBooking = (booking) => ({
  _id: booking._id,
  bookingCode: booking.bookingCode,
  responsibleName: booking.responsibleName,
  responsibleRelationship: booking.responsibleRelationship,
  responsibleRelationshipOther: booking.responsibleRelationshipOther,
  studentName: booking.studentName,
  tutorName: booking.tutorName,
  phone: booking.phone,
  email: booking.email,
  school: booking.school,
  educationLevel: booking.educationLevel,
  yearGrade: booking.yearGrade,
  subject: booking.subject,
  academicSituation: booking.academicSituation,
  timeSlot: booking.timeSlot,
  endTime: booking.endTime,
  duration: booking.duration,
  status: booking.status,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
});

const setNoStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

const trustedFilter = (filter) => mongoose.trusted(filter);

const badRequest = (res, message, details) =>
  res.status(400).json({
    success: false,
    message,
    details,
    requestId: res.req.requestId,
  });

const notFound = (res, message) =>
  res.status(404).json({
    success: false,
    message,
    requestId: res.req.requestId,
  });

const hasConflict = async (startTime, endTime, excludeId = null) => {
  const criteria = {
    ...activeStatusFilter,
    timeSlot: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeId) {
    criteria._id = { $ne: excludeId };
  }

  return Booking.exists(trustedFilter(criteria));
};

const buildClientLookupCriteria = (identifier) => {
  const trimmed = String(identifier ?? "").trim();
  const email = normalizeEmail(trimmed);
  const phoneRegex = phoneDigitsRegex(trimmed);
  const code = normalizeCode(trimmed);

  if (looksLikeEmail(trimmed)) {
    return { email };
  }

  if (looksLikePhone(trimmed) && phoneRegex) {
    return { phone: phoneRegex };
  }

  return { bookingCode: code };
};

const getLookupMode = (identifier) => {
  const trimmed = String(identifier ?? "").trim();

  if (looksLikeEmail(trimmed)) {
    return "email";
  }

  if (looksLikePhone(trimmed)) {
    return "phone";
  }

  return "code";
};

const buildHistoryCriteria = (booking, fallbackIdentifier) => {
  const phoneRegex = phoneDigitsRegex(booking.phone);

  if (booking.phone && phoneRegex) {
    return { phone: phoneRegex };
  }

  if (booking.email) {
    return { email: booking.email };
  }

  return buildClientLookupCriteria(fallbackIdentifier);
};

const isManageableByClient = (booking) =>
  booking.status !== "Cancelado" &&
  booking.status !== "Finalizado" &&
  new Date(booking.endTime).getTime() > Date.now();

const normalizeBookingPayload = (payload) => ({
  ...payload,
  email: normalizeEmail(payload.email),
  phone: normalizePhone(payload.phone),
  responsibleRelationship: String(payload.responsibleRelationship ?? "")
    .trim()
    .toLowerCase(),
  responsibleRelationshipOther: String(payload.responsibleRelationshipOther ?? "")
    .trim(),
  tutorName: payload.tutorName?.trim() || "Agustin",
});

const parseAvailabilityRange = (query) => {
  const parsed = availabilityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return null;
  }

  const defaults = getDefaultAvailabilityRange();
  const from = parsed.data.from ? parseDateTimeInput(parsed.data.from) : defaults.from;
  const to = parsed.data.to ? parseDateTimeInput(parsed.data.to) : defaults.to;

  if (!from || !to || from > to) {
    return null;
  }

  if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_MS) {
    return null;
  }

  return { from, to };
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const createBooking = async (req, res, next) => {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Revisa los datos de la reserva.", parsed.error.flatten());
    }

    const payload = normalizeBookingPayload(parsed.data);
    const contactError = validateContact(payload);
    if (contactError) {
      return badRequest(res, contactError);
    }

    const startTime = parseDateTimeInput(payload.timeSlot);
    const duration = Number(payload.duration);
    const slotError = validateSlot(startTime, duration);
    if (slotError) {
      return badRequest(res, slotError);
    }

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    const conflict = await hasConflict(startTime, endTime);
    if (conflict) {
      return badRequest(res, "Horario ocupado.");
    }

    const newBooking = await Booking.create({
      responsibleName: payload.responsibleName,
      responsibleRelationship: payload.responsibleRelationship,
      responsibleRelationshipOther: payload.responsibleRelationshipOther,
      studentName: payload.studentName,
      tutorName: payload.tutorName,
      email: payload.email,
      phone: payload.phone,
      school: payload.school,
      educationLevel: payload.educationLevel,
      yearGrade: payload.yearGrade,
      subject: payload.subject,
      academicSituation: payload.academicSituation,
      timeSlot: startTime,
      endTime,
      duration,
      notes: "",
      status: "Confirmado",
    });

    // Respond immediately after DB insert — side effects run in background
    res.status(201).json({
      success: true,
      message: "Reserva confirmada con exito.",
      data: publicBooking(newBooking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      appendBookingToSheet(newBooking),
      sendBookingNotifications({ booking: newBooking, event: "created" }),
    ]).catch((err) => console.error("[createBooking side-effects]", err.message));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "No se pudo generar un codigo unico. Intenta nuevamente.",
        requestId: req.requestId,
      });
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getAvailability = async (req, res, next) => {
  try {
    const range = parseAvailabilityRange(req.query);
    if (!range) {
      return badRequest(
        res,
        `Rango de disponibilidad invalido. Usa un intervalo maximo de ${MAX_AVAILABILITY_RANGE_DAYS} dias.`,
      );
    }

    const bookings = await Booking.find(
      trustedFilter({
        ...activeStatusFilter,
        timeSlot: { $lte: range.to },
        endTime: { $gte: range.from },
      }),
    )
      .select("timeSlot endTime duration status")
      .lean()
      .sort({ timeSlot: 1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings.map((booking) => ({
        _id: booking._id,
        timeSlot: booking.timeSlot,
        endTime: booking.endTime,
        duration: booking.duration,
        status: booking.status,
      })),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    setNoStore(res);

    const bookings = await Booking.find().sort({ timeSlot: -1 }).lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const getBookingByCode = async (req, res, next) => {
  try {
    const identifier = String(req.params.code ?? "").trim();
    const isValidLookup =
      normalizeCode(identifier).length >= 6 ||
      looksLikeEmail(identifier) ||
      looksLikePhone(identifier);

    if (!isValidLookup) {
      return badRequest(res, "Ingresa un codigo, email o telefono valido.");
    }

    const lookupMode = getLookupMode(identifier);
    const keyBooking = await Booking.findOne(buildClientLookupCriteria(identifier)).lean();

    if (!keyBooking) {
      return notFound(res, "No encontramos ninguna reserva.");
    }

    const searchCriteria =
      lookupMode === "code"
        ? { bookingCode: keyBooking.bookingCode }
        : buildHistoryCriteria(keyBooking, identifier);

    const history = await Booking.find(searchCriteria).sort({ timeSlot: -1 }).lean();

    setNoStore(res);
    res.status(200).json({
      success: true,
      data: history.map(publicBooking),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de actualizacion invalidos.", parsed.error.flatten());
    }

    const updateData = { ...parsed.data };

    if (updateData.timeSlot !== undefined) {
      const existing = await Booking.findById(req.params.id).select("duration").lean();
      if (!existing) {
        return notFound(res, "Reserva no encontrada.");
      }

      const startTime = parseDateTimeInput(updateData.timeSlot);
      const duration = Number(existing.duration) || 1;
      const slotError = validateSlot(startTime, duration);
      if (slotError) {
        return badRequest(res, slotError);
      }

      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
      const conflict = await hasConflict(startTime, endTime, req.params.id);
      if (conflict) {
        return badRequest(res, "El nuevo horario tiene conflicto con otra reserva activa.");
      }

      updateData.timeSlot = startTime;
      updateData.endTime = endTime;
    }

    const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedBooking) {
      return notFound(res, "Reserva no encontrada.");
    }

    await updateBookingInSheet(updatedBooking);

    setNoStore(res);
    res.status(200).json({
      success: true,
      data: updatedBooking,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const deleteBooking = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return badRequest(res, "Identificador de reserva invalido.");
    }

    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) {
      return notFound(res, "Reserva no encontrada.");
    }

    await deleteBookingFromSheet(deletedBooking.bookingCode);

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Reserva eliminada.",
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const deleteAllBookings = async (req, res, next) => {
  try {
    await Booking.deleteMany({});
    await resetBookingSheet();

    setNoStore(res);
    res.status(200).json({
      success: true,
      message: "Sistema reiniciado completamente.",
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const rescheduleBooking = async (req, res, next) => {
  try {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Datos de reprogramacion invalidos.", parsed.error.flatten());
    }

    const cleanCode = normalizeCode(parsed.data.bookingCode);
    const booking = await Booking.findOne({ bookingCode: cleanCode });

    if (!booking) {
      return notFound(res, "Codigo no encontrado.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden reprogramar turnos activos que todavia no finalizaron.",
      );
    }

    const startTime = parseDateTimeInput(parsed.data.newTimeSlot);
    const duration = Number(parsed.data.newDuration);
    const slotError = validateSlot(startTime, duration);
    if (slotError) {
      return badRequest(res, slotError);
    }

    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    const conflict = await hasConflict(startTime, endTime, booking._id);
    if (conflict) {
      return badRequest(res, "Horario ocupado.");
    }

    const previousTimeSlot = booking.timeSlot;

    booking.timeSlot = startTime;
    booking.endTime = endTime;
    booking.duration = duration;
    booking.status = "Confirmado";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Turno reprogramado.",
      data: publicBooking(booking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(booking),
      sendBookingNotifications({ booking, event: "rescheduled", previousTimeSlot }),
    ]).catch((err) => console.error("[rescheduleBooking side-effects]", err.message));
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};

export const cancelBookingClient = async (req, res, next) => {
  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Codigo de cancelacion invalido.", parsed.error.flatten());
    }

    const booking = await Booking.findOne({
      bookingCode: normalizeCode(parsed.data.bookingCode),
    });

    if (!booking) {
      return notFound(res, "No encontrado.");
    }

    if (!isManageableByClient(booking)) {
      return badRequest(
        res,
        "Solo se pueden cancelar turnos activos que todavia no finalizaron.",
      );
    }

    booking.status = "Cancelado";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Turno cancelado.",
      data: publicBooking(booking),
      notifications: null,
      requestId: req.requestId,
    });

    Promise.allSettled([
      updateBookingInSheet(booking),
      sendBookingNotifications({ booking, event: "cancelled" }),
    ]).catch((err) => console.error("[cancelBooking side-effects]", err.message));
  } catch (error) {
    if (typeof next === "function") {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      requestId: req.requestId,
    });
  }
};
