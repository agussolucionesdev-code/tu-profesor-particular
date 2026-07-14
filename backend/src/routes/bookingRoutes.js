import express from "express";
import {
  createBooking,
  createAdminBooking,
  getAvailability,
  getAdminAvailability,
  getBookingByCode,
  getAllBookings,
  getBookingStats,
  deleteBooking,
  restoreBooking,
  updateBooking,
  updateBookingAttendance,
  deleteAllBookings,
  rescheduleBooking,
  cancelBookingClient,
  confirmAttendanceClient,
  updateStudentNotes,
  requestManagementLink,
  getManagedBooking,
  revokeManagementAccess,
} from "../controllers/bookingController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import {
  publicLookupLimiter,
  publicMutationLimiter,
} from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/reserve", publicMutationLimiter, createBooking);
router.get("/availability", getAvailability);
// Management routes must precede /:code so bearer tokens never become a
// route parameter (and therefore never reach access logs).
router.post("/manage/request-link", publicMutationLimiter, requestManagementLink);
router.get("/manage", publicMutationLimiter, getManagedBooking);
router.post("/manage/revoke", publicMutationLimiter, revokeManagementAccess);
router.post("/reschedule", publicMutationLimiter, rescheduleBooking);
router.post("/cancel", publicMutationLimiter, cancelBookingClient);
router.post("/confirm-attendance", publicMutationLimiter, confirmAttendanceClient);
router.put("/:code/notes", publicMutationLimiter, updateStudentNotes);

router.get("/stats", requireAdmin, getBookingStats);
router.get("/admin/availability", requireAdmin, getAdminAvailability);
router.get("/", requireAdmin, getAllBookings);
router.post("/", requireAdmin, createAdminBooking);
if (process.env.NODE_ENV !== "production") {
  router.delete("/all", requireAdmin, deleteAllBookings);
}
router.delete("/:id", requireAdmin, deleteBooking);
router.post("/:id/restore", requireAdmin, restoreBooking);
router.patch("/:id/attendance", requireAdmin, updateBookingAttendance);
router.put("/:id", requireAdmin, updateBooking);

router.get("/:code", publicLookupLimiter, getBookingByCode);

export default router;
