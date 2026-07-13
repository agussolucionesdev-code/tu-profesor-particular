import express from "express";
import {
  getPublicSettings,
  getAllSettings,
  getAdminSchedule,
  updateAdminSchedule,
  updateSetting,
} from "../controllers/settingsController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getPublicSettings);
router.get("/admin", requireAdmin, getAllSettings);
router.get("/admin/schedule", requireAdmin, getAdminSchedule);
router.put("/admin/schedule", requireAdmin, updateAdminSchedule);
router.put("/:key", requireAdmin, updateSetting);

export default router;
