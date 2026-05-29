const escapeCell = (value) => {
  const str = String(value ?? "").replace(/"/g, '""');
  return /[",\n\r]/.test(str) ? `"${str}"` : str;
};

const row = (values) => values.map(escapeCell).join(",");

const HEADERS = [
  "Código",
  "Alumno",
  "Responsable",
  "Vínculo",
  "Nivel educativo",
  "Año/Curso",
  "Materia",
  "Institución",
  "Estado",
  "Fecha/Hora",
  "Duración (h)",
  "Precio ($)",
  "Email",
  "Teléfono",
  "Fecha de reserva",
];

const formatLocalDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
};

export const bookingsToCSV = (bookings) => {
  const lines = [row(HEADERS)];
  for (const b of bookings) {
    lines.push(
      row([
        b.bookingCode ?? "",
        b.studentName ?? "",
        b.responsibleName ?? "",
        b.responsibleRelationship ?? "",
        b.educationLevel ?? "",
        b.yearGrade ?? "",
        b.subject ?? "",
        b.school ?? "",
        b.status ?? "",
        formatLocalDate(b.timeSlot),
        b.duration ?? "",
        b.price ?? "",
        b.email ?? "",
        b.phone ?? "",
        formatLocalDate(b.createdAt),
      ]),
    );
  }
  return "﻿" + lines.join("\r\n");
};

export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportBookingsToCSV = (bookings, filename = "turnos.csv") => {
  downloadCSV(bookingsToCSV(bookings), filename);
};
