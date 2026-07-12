import { describe, expect, it } from "vitest";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
  buildManagementLinkEmailHtml,
  buildManagementLinkEmailText,
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
  it.each(["created", "rescheduled", "cancelled", "reminder"])(
    "builds the %s HTML template with explicit teacher location data",
    (event) => {
      const html = buildBookingEmailHtml({
        booking,
        event,
        dateStr: "20/04/2026, 10:00",
        previousDateStr:
          event === "rescheduled" ? "19/04/2026, 09:00" : "",
        teacherAddress: "Dirección de prueba 123",
        teacherMapsUrl: "https://maps.example.com/test",
      });

      expect(html).toContain("Dirección de prueba 123");
      expect(html).toContain("https://maps.example.com/test");
      expect(html).toContain("ABC123");
    },
  );

  it("renders a warm client confirmation with code and management CTA", () => {
    const html = buildBookingEmailHtml({
      booking: {
        ...booking,
        managementUrl: `https://frontend.example.com/m#token=${"c".repeat(43)}`,
      },
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

  it.each(["created", "rescheduled"])(
    "uses the secure management URL in %s client emails",
    (event) => {
      const managementUrl = `https://frontend.example.com/m#token=${"a".repeat(43)}`;
      const html = buildBookingEmailHtml({
        booking: { ...booking, managementUrl },
        event,
        dateStr: "20/04/2026, 10:00",
      });
      const text = buildBookingEmailText({
        booking: { ...booking, managementUrl },
        event,
        dateStr: "20/04/2026, 10:00",
      });

      expect(html).toContain(managementUrl);
      expect(text).toContain(managementUrl);
    },
  );

  it("builds a generic management-link email without exposing private booking data", () => {
    const managementUrl = `https://frontend.example.com/m#token=${"b".repeat(43)}`;
    const html = buildManagementLinkEmailHtml({ booking, managementUrl });
    const text = buildManagementLinkEmailText({ booking, managementUrl });

    expect(html).toContain(managementUrl);
    expect(text).toContain(managementUrl);
    expect(html).toContain("ABC123");
    expect(html).not.toContain(booking.academicSituation);
  });
});
