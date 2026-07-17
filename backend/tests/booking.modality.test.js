import { describe, expect, it } from "vitest";
import {
  BOOKING_MODALITY,
  DEFAULT_BOOKING_MODALITY,
  adminCreateBookingSchema,
  createBookingSchema,
  formatModalityLabel,
  updateBookingSchema,
} from "../src/utils/bookingRules.js";

const validBooking = (overrides = {}) => ({
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
  ...overrides,
});

describe("modalidad — catálogo", () => {
  it("expone exactamente online y presencial", () => {
    expect(BOOKING_MODALITY).toEqual(["online", "presencial"]);
  });

  it("usa online como default", () => {
    // Las reservas historicas no tienen modalidad. El default las mantiene
    // validas en vez de romper el back-fill.
    expect(DEFAULT_BOOKING_MODALITY).toBe("online");
    expect(BOOKING_MODALITY).toContain(DEFAULT_BOOKING_MODALITY);
  });
});

describe("createBookingSchema — modalidad", () => {
  it("acepta online", () => {
    const result = createBookingSchema.safeParse(validBooking({ modality: "online" }));
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("online");
  });

  it("acepta presencial", () => {
    const result = createBookingSchema.safeParse(
      validBooking({ modality: "presencial" }),
    );
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("presencial");
  });

  it("cae en online cuando se omite, para no romper clientes viejos", () => {
    const result = createBookingSchema.safeParse(validBooking());
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("online");
  });

  it("normaliza mayusculas y espacios", () => {
    const result = createBookingSchema.safeParse(
      validBooking({ modality: "  PRESENCIAL  " }),
    );
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("presencial");
  });

  it("rechaza una modalidad desconocida", () => {
    const result = createBookingSchema.safeParse(
      validBooking({ modality: "hibrida" }),
    );
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors).toHaveProperty("modality");
  });

  it("rechaza una modalidad vacia explicita", () => {
    const result = createBookingSchema.safeParse(validBooking({ modality: "" }));
    expect(result.success).toBe(false);
  });
});

describe("adminCreateBookingSchema — modalidad", () => {
  const validAdminBooking = (overrides = {}) => ({
    ...validBooking(),
    school: "Escuela Normal",
    academicSituation: "Refuerzo",
    ...overrides,
  });

  it("acepta presencial", () => {
    const result = adminCreateBookingSchema.safeParse(
      validAdminBooking({ modality: "presencial" }),
    );
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("presencial");
  });

  it("cae en online cuando se omite", () => {
    const result = adminCreateBookingSchema.safeParse(validAdminBooking());
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("online");
  });

  it("rechaza una modalidad desconocida", () => {
    const result = adminCreateBookingSchema.safeParse(
      validAdminBooking({ modality: "zoom" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("updateBookingSchema — modalidad", () => {
  it("permite corregir la modalidad de una reserva existente", () => {
    const result = updateBookingSchema.safeParse({ modality: "presencial" });
    expect(result.success).toBe(true);
    expect(result.data.modality).toBe("presencial");
  });

  it("rechaza una modalidad desconocida", () => {
    const result = updateBookingSchema.safeParse({ modality: "telefonica" });
    expect(result.success).toBe(false);
  });
});

describe("formatModalityLabel", () => {
  it("devuelve una etiqueta legible en es-AR", () => {
    expect(formatModalityLabel("online")).toBe("Online");
    expect(formatModalityLabel("presencial")).toBe("Presencial");
  });

  it("cae en la etiqueta del default ante un valor desconocido o vacio", () => {
    // Los emails y el panel nunca deben renderizar un valor crudo ni "undefined".
    expect(formatModalityLabel("")).toBe("Online");
    expect(formatModalityLabel(undefined)).toBe("Online");
    expect(formatModalityLabel("cualquiera")).toBe("Online");
  });
});
