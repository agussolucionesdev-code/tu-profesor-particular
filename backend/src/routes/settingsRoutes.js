import express from "express";
import {
  getPublicSettings,
  getAllSettings,
  updateSetting,
} from "../controllers/settingsController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getPublicSettings);
router.get("/admin", requireAdmin, getAllSettings);
router.put("/:key", requireAdmin, updateSetting);

export default router;
