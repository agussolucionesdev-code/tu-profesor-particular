import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchPublicSettings } from "../../src/api/bookingApi";
import BookingKiosk from "../../src/components/BookingKiosk";

/* LOS CAMPOS DEL PASO 4, COMO LOS OYE UN LECTOR DE PANTALLA.
 *
 * Cada campo tiene cuatro piezas y cada una va a su lugar:
 *
 *   etiqueta  → el NOMBRE del campo: qué dato va.
 *   ayuda     → DESCRIPCIÓN: por qué se pide o cómo escribirlo.
 *   ejemplo   → placeholder, prescindible.
 *   error     → DESCRIPCIÓN, después de la ayuda.
 *
 * El error antes vivía dentro del <label>, así que pasaba a formar parte del nombre:
 * el lector anunciaba «Email (opcional) Revisá el email: parece que le falta el @»
 * como si ese fuera el nombre del campo, y después lo repetía por aria-describedby.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchPublicSettings: vi.fn(),
  createBooking: vi.fn(),
  sendSeriesSummary: vi.fn(),
  fetchAvailability: vi.fn(),
}));

const UN_DIA = [
  { dateKey: "2026-09-02", slots: [{ timeObj: new Date("2026-09-02T15:00:00.000Z") }] },
];

vi.mock("../../src/hooks/useBookingAvailability", () => ({
  useBookingAvailability: () => ({
    upcomingSlotsByDay: UN_DIA,
    availabilityStatus: "ready",
    availabilityMatchesSelectedDuration: true,
    isSelectedTimeVerified: true,
    maxAllowedDuration: 3,
    retryAvailability: vi.fn(),
  }),
}));

vi.mock("../../src/components/KioskSlotCalendar", () => ({
  default: ({ onPick, onConfirm }) => (
    <>
      <button type="button" onClick={() => onPick(new Date("2026-09-02T15:00:00.000Z"))}>
        Marcar turno de prueba
      </button>
      <button type="button" onClick={onConfirm}>
        Confirmar turno de prueba
      </button>
    </>
  ),
}));

const tocar = (nombre) => userEvent.click(screen.getByRole("button", { name: nombre }));
/* El calendario del paso 3 se carga diferido (BookingKiosk.jsx): aparece un
   instante después de llegar al paso. Se espera a que esté, como lo haría
   una persona, en vez de buscarlo en el mismo tick. */
const tocarCuandoAparezca = async (nombre) =>
  userEvent.click(await screen.findByRole("button", { name: nombre }));

const llegarAlPaso4 = async (paraQuien) => {
  fetchPublicSettings.mockResolvedValue({ data: { data: {} } });
  render(
    <MemoryRouter>
      <BookingKiosk />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /¿Para quién es la clase\?/i })).toBeTruthy(),
  );
  await tocar(paraQuien);
  await tocar(/Secundaria\. 1° a 6° año/i);
  await tocar(/Materia: Matemática/i);
  await tocar(/Continuar/i);
  await tocar(/^Online./i);
  await tocar(/Continuar/i);
  await tocarCuandoAparezca(/Marcar turno de prueba/i);
  await tocar(/Confirmar turno de prueba/i);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cada pieza del campo va a su lugar", () => {
  test("con el error a la vista, el nombre del campo sigue siendo sólo su etiqueta", async () => {
    await llegarAlPaso4(/Para otra persona/i);
    await tocar(/^Continuar/i);

    const alumno = await screen.findByRole("textbox", { name: "Nombre completo del alumno *" });
    expect(alumno).toHaveAccessibleDescription("Escribí el nombre completo del alumno.");
  });

  test("la ayuda del teléfono dice para qué se pide y queda asociada al campo", async () => {
    await llegarAlPaso4(/Para otra persona/i);

    const telefono = screen.getByRole("textbox", { name: "Tu número de WhatsApp *" });
    expect(telefono).toHaveAccessibleDescription("Te escribo para confirmar la reserva.");
  });

  test("la ayuda va primero y el error después, en el mismo orden que en pantalla", async () => {
    await llegarAlPaso4(/Para otra persona/i);
    await tocar(/^Continuar/i);

    const telefono = await screen.findByRole("textbox", { name: "Tu número de WhatsApp *" });
    expect(telefono).toHaveAccessibleDescription(
      "Te escribo para confirmar la reserva. Escribí tu número de WhatsApp.",
    );
  });

  test("reservando para uno mismo, el nombre del alumno es el propio", async () => {
    await llegarAlPaso4(/Para mí/i);

    expect(screen.getByRole("textbox", { name: "Tu nombre completo *" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /del alumno/i })).toBeNull();
  });

  test("el botón para cambiar dice qué cambia", async () => {
    /* «Cambiar» a secas, fuera de contexto —en la lista de controles de un lector de
       pantalla—, no dice qué se cambia. */
    await llegarAlPaso4(/Para otra persona/i);

    expect(screen.getByRole("button", { name: "Cambiar para quién es la clase" })).toBeTruthy();
  });
});
