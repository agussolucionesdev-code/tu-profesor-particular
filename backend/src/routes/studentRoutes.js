import express from "express";
import { getStudentById, getStudents } from "../controllers/studentController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireAdmin);
router.get("/", getStudents);
router.get("/:id", getStudentById);

export default router;
