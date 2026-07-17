import crypto from "node:crypto";
import mongoose from "mongoose";
import NotificationOutbox, {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from "../models/NotificationOutbox.js";
import AuditEvent from "../models/AuditEvent.js";
import Booking from "../models/Booking.js";
import {
  getEmailDeliveryHealth,
  refreshEmailDeliveryHealth,
} from "../config/mailer.js";

const isRetryable = (record, booking, now = new Date(), emailHealthy = getEmailDeliveryHealth().configured) => {
  if (
    !emailHealthy ||
    record.status !== "dead" ||
    record.attempts < record.maxAttempts ||
    !["retryable", "configuration"].includes(record.failureDisposition) ||
    ![undefined, null, "", "archived"].includes(record.retryOperationState) ||
    record.payloadPurgedAt ||
    !record.payloadCiphertext ||
    !record.expiresAt ||
    new Date(record.expiresAt) <= now ||
    !booking || booking.deletedAt
  ) return false;
  if (record.type === "booking_cancelled") return booking.status === "Cancelado";
  if (record.type === "management_link_requested") {
    return ["Confirmado", "Pendiente"].includes(booking.status) &&
      Boolean(record.managementTokenFingerprint) &&
      record.managementTokenFingerprint === booking.managementTokenHash &&
      !booking.managementTokenRevokedAt &&
      booking.managementTokenExpiresAt &&
      new Date(booking.managementTokenExpiresAt) > now;
  }
  const pendingType = ["booking_received_pending", "booking_pending_updated"].includes(record.type);
  if ((pendingType ? booking.status !== "Pendiente" : booking.status !== "Confirmado") || new Date(booking.timeSlot) <= now) return false;
  const expectedTimeSlot = record.type === "booking_reminder"
    ? new Date(record.expiresAt).getTime() + 18 * 60 * 60 * 1000
    : new Date(record.expiresAt).getTime();
  return new Date(booking.timeSlot).getTime() === expectedTimeSlot;
};

const RETRY_SAGA_STALE_MS = 5 * 60 * 1000;

const retryAuditDocument = (record, action, state) => ({
  actor: {
    id: record.retryActorId,
    role: record.retryActorRole,
    username: record.retryActorUsername,
  },
  action,
  entityType: "NotificationOutbox",
  entityId: record._id,
  requestId: record.retryRequestId,
  operationId: record.retryOperationId,
  before: { status: "dead" },
  after: { status: state === "committed" ? "queued" : "dead", state, operationId: record.retryOperationId },
});

const persistRetryAudit = async (record, action, state) => {
  if (!record.retryOperationId || !record.retryActorId || !record.retryRequestId) return;
  try {
    await new AuditEvent(retryAuditDocument(record, action, state)).save();
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
};

export const reconcileRetrySagas = async ({ now = new Date() } = {}) => {
  let cursor = null;
  for (let batch = 0; batch < 1_000; batch += 1) {
    const records = await NotificationOutbox.find({
      retryOperationState: { $in: ["requested", "committed", "failed"] },
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    })
      .select("+retryOperationId +retryOperationState +retryRequestedAt +retryActorId +retryActorRole +retryActorUsername +retryRequestId")
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    if (!records.length) break;
    cursor = records.at(-1)._id;
    for (const record of records) {
      try {
        if (record.retryOperationState === "committed") {
          await persistRetryAudit(record, "notification.retry.committed", "committed");
          await NotificationOutbox.updateOne(
            { _id: record._id, retryOperationId: record.retryOperationId, retryOperationState: "committed" },
            { $set: { retryOperationState: "archived" } },
          );
          continue;
        }
        let failed = record;
        if (record.retryOperationState === "requested") {
          if (!record.retryRequestedAt || now.getTime() - new Date(record.retryRequestedAt).getTime() < RETRY_SAGA_STALE_MS) continue;
          failed = await NotificationOutbox.findOneAndUpdate(
            { _id: record._id, retryOperationId: record.retryOperationId, retryOperationState: "requested" },
            { $set: { retryOperationState: "failed" } },
            { new: true },
          ).select("+retryOperationId +retryOperationState +retryActorId +retryActorRole +retryActorUsername +retryRequestId");
        }
        if (!failed) continue;
        await persistRetryAudit(failed, "notification.retry.failed", "failed");
        await NotificationOutbox.updateOne(
          { _id: record._id, retryOperationId: record.retryOperationId, retryOperationState: "failed" },
          { $set: { retryOperationState: "archived" } },
        );
      } catch (error) {
        console.error(`[notification-retry reconcile] ${error.message}`);
      }
    }
    if (records.length < 100) break;
  }
};

export const createRetrySagaRunner = ({ processor = reconcileRetrySagas } = {}) => {
  let active = null;
  const run = () => {
    if (active) return active;
    active = Promise.resolve(processor()).finally(() => { active = null; });
    return active;
  };
  run.waitForIdle = async ({ timeoutMs = 25_000 } = {}) => {
    if (!active) return true;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), Math.max(1, timeoutMs));
      timer.unref?.();
    });
    const completed = await Promise.race([active.then(() => true, () => true), timeout]);
    clearTimeout(timer);
    return completed;
  };
  return run;
};

const dto = (record, retryable = false) => ({
  id: String(record._id),
  status: record.status,
  retryable,
  failureDisposition: record.failureDisposition || null,
  type: record.type,
  channel: record.channel,
  booking: {
    id: String(record.booking),
    bookingCode: record.bookingCode,
  },
  recipient: { masked: record.recipientMasked },
  attempts: record.attempts,
  maxAttempts: record.maxAttempts,
  nextAttemptAt: record.nextAttemptAt || null,
  expiresAt: record.expiresAt || null,
  providerMessageId: record.providerMessageId || null,
  sentAt: record.sentAt || null,
  lastError: record.errorCategory
    ? { category: record.errorCategory, message: record.lastError }
    : null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const invalidQuery = (res, requestId) => res.status(400).json({
  success: false,
  message: "Filtros de notificaciones inválidos.",
  requestId,
});

export const listNotifications = async (req, res, next) => {
  try {
    await reconcileRetrySagas();
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const { status, type } = req.query;
    if (
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      (status && !NOTIFICATION_STATUSES.includes(status)) ||
      (type && !NOTIFICATION_TYPES.includes(type))
    ) return invalidQuery(res, req.requestId);
    const filter = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };
    const total = await NotificationOutbox.countDocuments(filter);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const canonicalPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const records = await NotificationOutbox.find(filter)
        .select("+payloadCiphertext +payloadPurgedAt +managementTokenFingerprint +retryOperationId +retryOperationState")
        .sort({ createdAt: -1, _id: -1 })
        .skip((canonicalPage - 1) * limit)
        .limit(limit)
        .lean();
    const bookings = await Booking.find({
      _id: { $in: records.map((record) => record.booking) },
    }).select("status timeSlot deletedAt +managementTokenHash managementTokenExpiresAt managementTokenRevokedAt").lean();
    const bookingsById = new Map(bookings.map((booking) => [String(booking._id), booking]));
    const now = new Date();
    return res.status(200).json({
      success: true,
      data: {
        items: records.map((record) => dto(
          record,
          isRetryable(record, bookingsById.get(String(record.booking)), now),
        )),
        pagination: {
          page: canonicalPage,
          limit,
          total,
          totalPages,
        },
      },
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const getNotification = async (req, res, next) => {
  try {
    await reconcileRetrySagas();
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Notificación no encontrada.", requestId: req.requestId });
    }
    const record = await NotificationOutbox.findById(req.params.id)
      .select("+payloadCiphertext +payloadPurgedAt +managementTokenFingerprint +retryOperationId +retryOperationState")
      .lean();
    if (!record) {
      return res.status(404).json({ success: false, message: "Notificación no encontrada.", requestId: req.requestId });
    }
    const booking = await Booking.findById(record.booking).select("status timeSlot deletedAt +managementTokenHash managementTokenExpiresAt managementTokenRevokedAt").lean();
    return res.status(200).json({
      success: true,
      data: dto(record, isRetryable(record, booking)),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};

export const retryNotification = async (req, res, next) => {
  let operationId = null;
  try {
    await reconcileRetrySagas();
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Notificación no encontrada.", requestId: req.requestId });
    }
    const before = await NotificationOutbox.findById(req.params.id)
      .select("+payloadCiphertext +payloadPurgedAt +payloadPurgeAt +managementTokenFingerprint +retryOperationId +retryOperationState")
      .lean();
    if (!before) {
      return res.status(404).json({ success: false, message: "Notificación no encontrada.", requestId: req.requestId });
    }
    const booking = await Booking.findById(before.booking).select("status timeSlot deletedAt +managementTokenHash managementTokenExpiresAt managementTokenRevokedAt").lean();
    const emailHealth = await refreshEmailDeliveryHealth({ force: true });
    if (!isRetryable(before, booking, new Date(), emailHealth.configured)) {
      return res.status(409).json({
        success: false,
        code: "NOTIFICATION_NOT_RETRYABLE",
        message: "La notificación no está en un estado reintentable.",
        requestId: req.requestId,
      });
    }
    operationId = crypto.randomUUID();
    const retryRequestedAt = new Date();
    const staged = await NotificationOutbox.findOneAndUpdate(
      {
        _id: before._id,
        status: before.status,
        updatedAt: before.updatedAt,
        failureDisposition: { $in: ["retryable", "configuration"] },
        retryOperationState: { $in: ["", "archived", null] },
        payloadCiphertext: { $exists: true },
      },
      { $set: {
        retryOperationId: operationId,
        retryOperationState: "requested",
        retryRequestedAt,
        retryActorId: req.user.id,
        retryActorRole: req.user.role,
        retryActorUsername: req.user.username,
        retryRequestId: req.requestId,
      } },
      { new: true },
    ).select("+retryOperationId +retryOperationState +retryActorId +retryActorRole +retryActorUsername +retryRequestId");
    if (!staged) {
      return res.status(409).json({
        success: false,
        code: "NOTIFICATION_NOT_RETRYABLE",
        message: "La notificación cambió mientras se solicitaba el reintento.",
        requestId: req.requestId,
      });
    }
    try {
      await persistRetryAudit(staged, "notification.retry.requested", "requested");
    } catch (error) {
      await NotificationOutbox.collection.updateOne(
        { _id: before._id, retryOperationId: operationId },
        { $set: { retryOperationState: "failed" } },
      );
      throw error;
    }
    let updated;
    try {
      updated = await NotificationOutbox.findOneAndUpdate(
        {
          _id: before._id,
          status: before.status,
          retryOperationId: operationId,
          retryOperationState: "requested",
          payloadCiphertext: { $exists: true },
        },
        {
          $set: {
            status: "queued",
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: "",
            errorCategory: "",
            failureDisposition: "",
            providerMessageId: null,
            sentAt: null,
            retryOperationState: "committed",
          },
          $unset: {
            leaseOwner: "",
            leaseExpiresAt: "",
            deliveryPhase: "",
            payloadPurgeAt: "",
            payloadPurgedAt: "",
          },
        },
        { new: true, runValidators: true },
      ).select("+payloadCiphertext +payloadPurgedAt +retryOperationId +retryOperationState +retryActorId +retryActorRole +retryActorUsername +retryRequestId");
    } catch (error) {
      const failed = await NotificationOutbox.findOneAndUpdate(
        { _id: before._id, retryOperationId: operationId, retryOperationState: "requested" },
        { $set: { retryOperationState: "failed" } },
        { new: true },
      ).select("+retryOperationId +retryOperationState +retryActorId +retryActorRole +retryActorUsername +retryRequestId");
      if (failed) await persistRetryAudit(failed, "notification.retry.failed", "failed").catch(() => {});
      throw error;
    }
    if (!updated) {
      const failed = await NotificationOutbox.findOneAndUpdate(
        { _id: before._id, retryOperationId: operationId, retryOperationState: "requested" },
        { $set: { retryOperationState: "failed" } },
        { new: true },
      ).select("+retryOperationId +retryOperationState +retryActorId +retryActorRole +retryActorUsername +retryRequestId");
      if (failed) await persistRetryAudit(failed, "notification.retry.failed", "failed").catch(() => {});
      return res.status(409).json({
        success: false,
        code: "NOTIFICATION_NOT_RETRYABLE",
        message: "La notificación cambió mientras se solicitaba el reintento.",
        requestId: req.requestId,
      });
    }
    try {
      await persistRetryAudit(updated, "notification.retry.committed", "committed");
      await NotificationOutbox.updateOne(
        { _id: updated._id, retryOperationId: operationId, retryOperationState: "committed" },
        { $set: { retryOperationState: "archived" } },
      );
    } catch (error) {
      // The committed state and actor metadata are durable. The next admin
      // read reconciles the missing audit without re-queuing a second time.
      console.error(`[notification-retry audit] ${error.message}`);
    }
    return res.status(200).json({
      success: true,
      data: dto(updated, false),
      requestId: req.requestId,
    });
  } catch (error) {
    if (typeof next === "function") return next(error);
    return res.status(500).json({ success: false, message: "Error interno.", requestId: req.requestId });
  }
};
