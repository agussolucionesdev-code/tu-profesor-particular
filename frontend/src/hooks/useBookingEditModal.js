import { useCallback, useState } from "react";

export const useBookingEditModal = (updateBookingFields, updateBookingAttendance) => {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEvolution, setEditEvolution] = useState("");
  const [editEmotionalState, setEditEmotionalState] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("Sin registrar");
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceFeedback, setAttendanceFeedback] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editFeedback, setEditFeedback] = useState(null);

  const openEditBooking = useCallback((booking) => {
    setSelectedBooking(booking);
    setEditNotes(booking.notes || "");
    setEditEvolution(booking.studentEvolution || "");
    setEditEmotionalState(booking.emotionalState || "");
    setAttendanceStatus(booking.attendanceStatus || "Sin registrar");
    setAttendanceNotes(booking.attendanceNotes || "");
    setAttendanceFeedback(null);
    setEditFeedback(null);
  }, []);

  const handleAttendanceSave = useCallback(async () => {
    if (!selectedBooking || attendanceSaving) return;
    setAttendanceSaving(true);
    setAttendanceFeedback(null);
    try {
      const updatedBooking = await updateBookingAttendance(selectedBooking._id, {
        attendanceStatus,
        attendanceNotes,
      });
      setSelectedBooking((current) => ({
        ...updatedBooking,
        // Attendance persists independently from the rest of this form.
        status: current?.status ?? updatedBooking.status,
      }));
      setAttendanceStatus(updatedBooking.attendanceStatus || "Sin registrar");
      setAttendanceNotes(updatedBooking.attendanceNotes || "");
      setAttendanceFeedback({ type: "success", message: "Asistencia guardada correctamente." });
    } catch (error) {
      setAttendanceFeedback({
        type: "error",
        message: error?.response?.data?.message || "No se pudo guardar la asistencia.",
      });
    } finally {
      setAttendanceSaving(false);
    }
  }, [
    attendanceNotes,
    attendanceSaving,
    attendanceStatus,
    selectedBooking,
    updateBookingAttendance,
  ]);

  const handleSave = useCallback(async () => {
    if (!selectedBooking || editSaving) return;
    setEditSaving(true);
    setEditFeedback(null);
    try {
      const payload = {
        status: selectedBooking.status,
        notes: editNotes,
        studentEvolution: editEvolution,
        emotionalState: editEmotionalState,
      };
      await updateBookingFields(selectedBooking._id, payload);
      setSelectedBooking(null);
    } catch (error) {
      setEditFeedback({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "No se pudieron guardar los cambios.",
      });
    } finally {
      setEditSaving(false);
    }
  }, [
    editEmotionalState,
    editEvolution,
    editNotes,
    editSaving,
    selectedBooking,
    updateBookingFields,
  ]);

  const closeEditBooking = useCallback(() => setSelectedBooking(null), []);

  const handleStatusChange = useCallback(
    (e) =>
      setSelectedBooking((current) =>
        current ? { ...current, status: e.target.value } : null,
      ),
    [],
  );

  return {
    selectedBooking,
    editNotes,
    editEvolution,
    editEmotionalState,
    attendanceStatus,
    attendanceNotes,
    attendanceSaving,
    attendanceFeedback,
    editSaving,
    editFeedback,
    setEditNotes,
    setEditEvolution,
    setEditEmotionalState,
    setAttendanceStatus,
    setAttendanceNotes,
    openEditBooking,
    closeEditBooking,
    handleSave,
    handleStatusChange,
    handleAttendanceSave,
  };
};
