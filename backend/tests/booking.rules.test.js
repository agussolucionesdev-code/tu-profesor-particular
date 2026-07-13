import { describe, expect, it } from "vitest";
import { createBookingSchema } from "../src/utils/bookingRules.js";

const validBooking = {
  responsibleName: "Mayor de edad / Responsable",
  responsibleRelationship: "self",
  studentName: "Alumno Prueba",
  email: "",
  phone: "+54 9 11-2222-3333",
  school: "",
  educationLevel: "Secundaria",
  yearGrade: "3er año",
  subject: "Matemática",
  academicSituation: "Objetivo: Preparar el examen",
  timeSlot: "10/08/2026 15:00",
  duration: 1,
};

describe("createBookingSchema", () => {
  it("accepts an omitted institution for the three-stage public wizard", () => {
    const result = createBookingSchema.safeParse(validBooking);

    expect(result.success).toBe(true);
    expect(result.data.school).toBe("");
  });
});
