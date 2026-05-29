import AppSettings from "../models/AppSettings.js";

const SCHEDULE_KEYS = [
  "schedule.openingHour",
  "schedule.closingHour",
  "schedule.advanceNoticeMinutes",
  "schedule.slotDurationMinutes",
];

const PUBLIC_KEYS = [...SCHEDULE_KEYS, "booking.pricePerHour", "booking.subjectsByLevel"];

const ADMIN_ONLY_KEYS = [
  "booking.requireManualConfirmation",
  "sheets.syncStatus",
  "cron.lastReminderRun",
  "teacher.address",
  "teacher.mapsUrl",
];
const ALLOWED_KEYS = [...PUBLIC_KEYS, ...ADMIN_ONLY_KEYS];

const DEFAULTS = {
  "schedule.openingHour": 7,
  "schedule.closingHour": 22,
  "schedule.advanceNoticeMinutes": 60,
  "schedule.slotDurationMinutes": 30,
  "booking.pricePerHour": 0,
  "booking.requireManualConfirmation": false,
  "booking.subjectsByLevel": null,
  "teacher.address": process.env.TEACHER_ADDRESS || "Jujuy 414, Temperley, Buenos Aires",
  "teacher.mapsUrl": process.env.TEACHER_MAPS_URL || "https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires",
};

export const getPublicSettings = async (req, res, next) => {
  try {
    const records = await AppSettings.find({ key: { $in: PUBLIC_KEYS } }).lean();
    const settings = { ...Object.fromEntries(PUBLIC_KEYS.map((k) => [k, DEFAULTS[k]])) };
    records.forEach((r) => { settings[r.key] = r.value; });

    res.status(200).json({ success: true, data: settings, requestId: req.requestId });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const getAllSettings = async (req, res, next) => {
  try {
    const records = await AppSettings.find({ key: { $in: ALLOWED_KEYS } }).lean();
    const settings = { ...Object.fromEntries(ALLOWED_KEYS.map((k) => [k, DEFAULTS[k]])) };
    records.forEach((r) => { settings[r.key] = r.value; });

    res.status(200).json({ success: true, data: settings, requestId: req.requestId });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;

    const WRITABLE_KEYS = [...PUBLIC_KEYS, "booking.requireManualConfirmation", "booking.subjectsByLevel", "teacher.address", "teacher.mapsUrl"];
    if (!WRITABLE_KEYS.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Clave no permitida: ${key}`,
        requestId: req.requestId,
      });
    }

    const { value } = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: "Falta el campo 'value'.",
        requestId: req.requestId,
      });
    }

    const updated = await AppSettings.findOneAndUpdate(
      { key },
      { $set: { key, value } },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, data: updated, requestId: req.requestId });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

/**
 * Helper used by other controllers to read a single setting with fallback.
 */
export const getSetting = async (key) => {
  const record = await AppSettings.findOne({ key }).lean();
  return record !== null ? record.value : DEFAULTS[key];
};
