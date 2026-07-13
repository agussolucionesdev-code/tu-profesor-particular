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

  const openEditBooking = useCallback((booking) => {
    setSelectedBooking(booking);
    setEditNotes(booking.notes || "");
    setEditEvolution(booking.studentEvolution || "");
    setEditEmotionalState(booking.emotionalState || "");
    setAttendanceStatus(booking.attendanceStatus || "Sin registrar");
    setAttendanceNotes(booking.attendanceNotes || "");
    setAttendanceFeedback(null);
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
    try {
      const payload = {
        status: selectedBooking.status,
        notes: editNotes,
        studentEvolution: editEvolution,
        emotionalState: editEmotionalState,
      };
      await updateBookingFields(selectedBooking._id, payload);
      setSelectedBooking(null);
    } catch {
      alert("No se pudieron guardar los cambios.");
    }
  }, [selectedBooking, editNotes, editEvolution, editEmotionalState, updateBookingFields]);

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
