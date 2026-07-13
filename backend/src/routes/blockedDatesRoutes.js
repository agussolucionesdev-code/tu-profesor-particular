import express from "express";
import {
  getBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from "../controllers/blockedDatesController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAdmin, getBlockedDates);
router.post("/", requireAdmin, addBlockedDate);
router.delete("/:date", requireAdmin, removeBlockedDate);

export default router;
