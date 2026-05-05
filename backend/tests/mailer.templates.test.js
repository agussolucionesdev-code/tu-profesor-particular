import { describe, expect, it } from "vitest";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
} from "../src/config/mailer.js";

const booking = {
  bookingCode: "ABC123",
  studentName: "Lucia Perez",
  responsibleName: "Maria Perez",
  responsibleRelationship: "madre",
  responsibleRelationshipOther: "",
  subject: "Matematica",
  educationLevel: "Secundaria",
  yearGrade: "3er ano",
  school: "Escuela Normal",
  phone: "+54 9 11-2222-3333",
  email: "familia@example.com",
  academicSituation: "Necesita reforzar ecuaciones.",
  timeSlot: new Date("2026-04-20T10:00:00-03:00"),
};

describe("booking email templates", () => {
  it("renders a warm client confirmation with code and management CTA", () => {
    const html = buildBookingEmailHtml({
      booking,
      event: "created",
      dateStr: "20/04/2026, 10:00",
    });

    expect(html).toContain("Tu turno quedó reservado");
    expect(html).toContain("ABC123");
    expect(html).toContain("Ir a Mis Turnos");
    expect(html).toContain("Agustín Elías Sosa");
    expect(html).not.toContain("correctamente");
  });

  it("renders distinct reschedule and cancellation plain text", () => {
    const rescheduled = buildBookingEmailText({
      booking,
      event: "rescheduled",
      dateStr: "21/04/2026, 11:00",
    });
    const cancelled = buildBookingEmailText({
      booking,
      event: "cancelled",
      dateStr: "20/04/2026, 10:00",
    });

    expect(rescheduled).toContain("Tu turno fue reprogramado");
    expect(cancelled).toContain("Tu turno fue cancelado");
    expect(rescheduled).toContain("ABC123");
    expect(cancelled).toContain("ABC123");
  });
});
