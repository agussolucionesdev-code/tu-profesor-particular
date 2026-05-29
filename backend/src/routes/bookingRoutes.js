import express from "express";
import {
  createBooking,
  getAvailability,
  getBookingByCode,
  getAllBookings,
  getBookingStats,
  deleteBooking,
  updateBooking,
  deleteAllBookings,
  rescheduleBooking,
  cancelBookingClient,
  confirmAttendanceClient,
  updateStudentNotes,
} from "../controllers/bookingController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import {
  publicLookupLimiter,
  publicMutationLimiter,
} from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/reserve", publicMutationLimiter, createBooking);
router.get("/availability", getAvailability);
router.post("/reschedule", publicMutationLimiter, rescheduleBooking);
router.post("/cancel", publicMutationLimiter, cancelBookingClient);
router.post("/confirm-attendance", publicMutationLimiter, confirmAttendanceClient);
router.put("/:code/notes", publicMutationLimiter, updateStudentNotes);

router.get("/stats", requireAdmin, getBookingStats);
router.get("/", requireAdmin, getAllBookings);
if (process.env.NODE_ENV !== "production") {
  router.delete("/all", requireAdmin, deleteAllBookings);
}
router.delete("/:id", requireAdmin, deleteBooking);
router.put("/:id", requireAdmin, updateBooking);

router.get("/:code", publicLookupLimiter, getBookingByCode);

export default router;
