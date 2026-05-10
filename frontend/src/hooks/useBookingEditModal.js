import { useCallback, useState } from "react";

export const useBookingEditModal = (updateBookingFields) => {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEvolution, setEditEvolution] = useState("");
  const [editEmotionalState, setEditEmotionalState] = useState("");

  const openEditBooking = useCallback((booking) => {
    setSelectedBooking(booking);
    setEditNotes(booking.notes || "");
    setEditEvolution(booking.studentEvolution || "");
    setEditEmotionalState(booking.emotionalState || "");
  }, []);

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
    setEditNotes,
    setEditEvolution,
    setEditEmotionalState,
    openEditBooking,
    closeEditBooking,
    handleSave,
    handleStatusChange,
  };
};
