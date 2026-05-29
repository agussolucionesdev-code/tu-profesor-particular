import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getVapidPublicKey, saveAdminPushSubscription } from "../services/pushService.js";

const router = express.Router();

router.get("/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ success: false, message: "Web Push no configurado." });
  }
  res.json({ success: true, publicKey: key });
});

router.post("/subscribe", authMiddleware, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, message: "Suscripción inválida." });
    }
    await saveAdminPushSubscription(subscription);
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
