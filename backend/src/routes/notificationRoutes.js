import express from "express";
import { requireAdmin } from "../middleware/authMiddleware.js";
import {
  getNotification,
  listNotifications,
  retryNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(requireAdmin);
router.get("/", listNotifications);
router.get("/:id", getNotification);
router.post("/:id/retry", retryNotification);

export default router;
