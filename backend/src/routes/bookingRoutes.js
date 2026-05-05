import express from "express";
import {
  createBooking,
  getAvailability,
  getBookingByCode,
  getAllBookings,
  deleteBooking,
  updateBooking,
  deleteAllBookings,
  rescheduleBooking,
  cancelBookingClient,
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

const rejectInProduction = (req, res) => {
  res
    .status(403)
    .json({ success: false, message: "Not available in production." });
};

router.get("/", requireAdmin, getAllBookings);
router.delete(
  "/all",
  requireAdmin,
  process.env.NODE_ENV === "production" ? rejectInProduction : deleteAllBookings,
);
router.delete("/:id", requireAdmin, deleteBooking);
router.put("/:id", requireAdmin, updateBooking);

router.get("/:code", publicLookupLimiter, getBookingByCode);

export default router;
