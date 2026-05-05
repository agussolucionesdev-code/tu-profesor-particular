import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import {
  formatDate,
  formatResponsibleRelationshipLabel,
} from "../utils/bookingRules.js";

export const BOOKING_SHEET_HEADERS = [
  "Codigo",
  "Fecha Creacion",
  "Responsable",
  "Parentesco",
  "Alumno",
  "Tutor",
  "Nivel",
  "Anio/Grado",
  "Materia",
  "Escuela",
  "Situacion",
  "Telefono",
  "Email",
  "Horario",
  "Fin",
  "Duracion",
  "Precio",
  "Notas",
  "Estado",
];

let sheetPromise = null;

const isSheetsConfigured = () =>
  process.env.NODE_ENV !== "test" &&
  Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );

const loadSheet = async () => {
  if (!isSheetsConfigured()) {
    return null;
  }

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet =
    doc.sheetsByTitle[process.env.GOOGLE_SHEET_TITLE || "Reservas"] ||
    doc.sheetsByIndex[0];

  if (!sheet) throw new Error("No Google Sheet tab found.");

  try {
    await sheet.loadHeaderRow();
  } catch {
    await sheet.setHeaderRow(BOOKING_SHEET_HEADERS);
  }

  return sheet;
};

const getSheet = async () => {
  if (!sheetPromise) {
    sheetPromise = loadSheet().catch((error) => {
      sheetPromise = null;
      throw error;
    });
  }

  return sheetPromise;
};

export const bookingToSheetRow = (booking) => ({
  Codigo: booking.bookingCode,
  "Fecha Creacion": formatDate(booking.createdAt || new Date()),
  Responsable: booking.responsibleName,
  Parentesco: formatResponsibleRelationshipLabel(
    booking.responsibleRelationship,
    booking.responsibleRelationshipOther,
  ),
  Alumno: booking.studentName,
  Tutor: booking.tutorName,
  Nivel: booking.educationLevel,
  "Anio/Grado": booking.yearGrade,
  Materia: booking.subject,
  Escuela: booking.school || "-",
  Situacion: booking.academicSituation || "-",
  Telefono: booking.phone || "-",
  Email: booking.email || "-",
  Horario: formatDate(booking.timeSlot),
  Fin: formatDate(booking.endTime),
  Duracion: booking.duration,
  Precio: booking.price || 0,
  Notas: booking.notes || "",
  Estado: booking.status,
});

export const appendBookingToSheet = async (booking) => {
  try {
    const sheet = await getSheet();
    if (!sheet) return false;
    await sheet.addRow(bookingToSheetRow(booking));
    return true;
  } catch (error) {
    console.error("Google Sheets append error:", error.message);
    return false;
  }
};

export const updateBookingInSheet = async (booking) => {
  try {
    const sheet = await getSheet();
    if (!sheet) return false;

    const rows = await sheet.getRows();
    const row = rows.find((item) => item.get("Codigo") === booking.bookingCode);
    if (!row) {
      await sheet.addRow(bookingToSheetRow(booking));
      return true;
    }

    row.assign(bookingToSheetRow(booking));
    await row.save();
    return true;
  } catch (error) {
    console.error("Google Sheets update error:", error.message);
    return false;
  }
};

export const resetBookingSheet = async () => {
  try {
    const sheet = await getSheet();
    if (!sheet) return false;
    await sheet.clear();
    await sheet.setHeaderRow(BOOKING_SHEET_HEADERS);
    return true;
  } catch (error) {
    console.error("Google Sheets reset error:", error.message);
    return false;
  }
};

export const deleteBookingFromSheet = async (bookingCode) => {
  try {
    const sheet = await getSheet();
    if (!sheet) return false;

    const rows = await sheet.getRows();
    const matchingRows = rows.filter((row) => row.get("Codigo") === bookingCode);

    if (matchingRows.length === 0) {
      return true;
    }

    await Promise.all(matchingRows.map((row) => row.delete()));
    return true;
  } catch (error) {
    console.error("Google Sheets delete error:", error.message);
    return false;
  }
};
