import BlockedDate from "../models/BlockedDate.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message, requestId: res.req.requestId });

export const getBlockedDates = async (req, res, next) => {
  try {
    const records = await BlockedDate.find().sort({ date: 1 }).lean();
    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const addBlockedDate = async (req, res, next) => {
  try {
    const { date, reason = "" } = req.body || {};

    if (!date || !DATE_REGEX.test(date)) {
      return badRequest(res, "La fecha debe tener formato YYYY-MM-DD.");
    }

    const record = await BlockedDate.create({ date, reason });
    res.status(201).json({ success: true, data: record, requestId: req.requestId });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Esa fecha ya está bloqueada.",
        requestId: req.requestId,
      });
    }
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const removeBlockedDate = async (req, res, next) => {
  try {
    const { date } = req.params;

    if (!date || !DATE_REGEX.test(date)) {
      return badRequest(res, "La fecha debe tener formato YYYY-MM-DD.");
    }

    const deleted = await BlockedDate.findOneAndDelete({ date });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Fecha bloqueada no encontrada.",
        requestId: req.requestId,
      });
    }

    res.status(200).json({ success: true, message: "Fecha desbloqueada.", requestId: req.requestId });
  } catch (error) {
    if (typeof next === "function") return next(error);
    res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};
