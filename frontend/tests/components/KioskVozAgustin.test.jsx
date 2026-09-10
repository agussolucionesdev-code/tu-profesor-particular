import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchPublicSettings } from "../../src/api/bookingApi";
import BookingKiosk from "../../src/components/BookingKiosk";
import { NO_PUEDO_AYUDARTE } from "../../src/constants/voz";

/* LA VOZ DE AGUSTÍN DENTRO DEL FLUJO DE RESERVA.
 *
 * La voz se publicó primero SÓLO en el sitio institucional, y fue un error de análisis:
 * el institucional es la vitrina, pero TURNOS ES EL MOSTRADOR. Quien llega directo a
 * /reservar desde un WhatsApp —el canal principal del negocio— atravesaba los cinco
 * pasos, dejaba su teléfono y el nombre de su hijo, y no leía una sola palabra de él
 * hasta después de confirmar.
 *
 * La corrección es un solo bloque, en el paso 4. Lo que estos tests protegen no es que
 * el texto exista —eso lo cubre `web/tests/vozCompartida.test.js`— sino las tres
 * decisiones que lo hacen servir para algo, y que son justamente las que se pierden
 * cuando alguien refactoriza el wizard:
 *
 *   1. Que esté EN EL PASO 4, que es donde cambia lo que se pide: hasta el 3 elegías
 *      opciones; desde el 4 entregás datos de un menor.
 *   2. Que esté ANTES del primer campo. Debajo del formulario no lo lee nadie: para
 *      cuando llega, ya decidió si completa o cierra.
 *   3. Que sea UNA sola vez. Repetida en cada paso deja de ser una persona hablando y
 *      pasa a ser un folleto.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchPublicSettings: vi.fn(),
  createBooking: vi.fn(),
  sendSeriesSummary: vi.fn(),
  fetchAvailability: vi.fn(),
}));

/* Mismo andamiaje que `KioskParaQuien.test.jsx`: el stepper sólo deja volver atrás
   (`disabled={s.id >= step}`), así que al paso 4 se llega recorriéndolo entero, igual
   que lo recorre una persona. */
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

const montar = async () => {
  fetchPublicSettings.mockResolvedValue({ data: { data: {} } });
  render(
    <MemoryRouter>
      <BookingKiosk />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /¿Para quién es la clase\?/i })).toBeTruthy(),
  );
};

const tocar = (nombre) => userEvent.click(screen.getByRole("button", { name: nombre }));

const llegarAlPaso4 = async () => {
  await montar();
  await tocar(/Para otra persona/i);
  await tocar(/Secundaria\. 1° a 6° año/i);
  await tocar(/Materia: Matemática/i);
  await tocar(/Continuar/i);
  await tocar(/^Online./i);
  await tocar(/Continuar/i);
  await tocar(/Marcar turno de prueba/i);
  await tocar(/Confirmar turno de prueba/i);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("la voz de Agustín en el paso de los datos", () => {
  test("la cita aparece en el paso 4, textual", async () => {
    /* Textual y no parafraseada: es la regla de `constants/voz.js`. Se compara contra
       la constante, así que si alguien la reescribe en el JSX el test lo ve. */
    await llegarAlPaso4();

    expect(screen.getByText(NO_PUEDO_AYUDARTE)).toBeTruthy();
  });

  test("va ANTES del primer campo, no debajo del formulario", async () => {
    /* La decisión que hace que sirva. Debajo del formulario el bloque existiría y no
       lo leería nadie: para cuando se llega, ya se decidió completar o cerrar.
       `compareDocumentPosition` es la única forma honesta de afirmarlo — que ambos
       estén en la pantalla no dice en qué orden se leen. */
    await llegarAlPaso4();

    const cita = screen.getByText(NO_PUEDO_AYUDARTE);
    const primerCampo = screen.getByLabelText(/Nombre del alumno/i);

    expect(
      cita.compareDocumentPosition(primerCampo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("está firmada, para que se sepa quién habla", async () => {
    /* Sin firma es una frase suelta en un formulario. Con firma es una persona. Y la
       firma dice «tu profesor» y no un cargo: es lo que va a ser de quien lee. */
    await llegarAlPaso4();

    expect(screen.getByText(/Agustín, tu profesor/i)).toBeTruthy();
  });

  test("no aparece antes del paso 4", async () => {
    /* Un solo momento. Repetida en cada paso deja de sonar a alguien hablando y pasa a
       sonar a folleto — que es exactamente lo que este material vino a evitar. */
    await montar();
    expect(screen.queryByText(NO_PUEDO_AYUDARTE)).toBeNull();

    await tocar(/Para otra persona/i);
    expect(screen.queryByText(NO_PUEDO_AYUDARTE)).toBeNull();

    await tocar(/Secundaria\. 1° a 6° año/i);
    expect(screen.queryByText(NO_PUEDO_AYUDARTE)).toBeNull();

    await tocar(/Materia: Matemática/i);
    await tocar(/Continuar/i);
    expect(screen.queryByText(NO_PUEDO_AYUDARTE)).toBeNull();
  });

  test("aparece una sola vez en el paso 4", async () => {
    await llegarAlPaso4();

    expect(screen.getAllByText(NO_PUEDO_AYUDARTE)).toHaveLength(1);
  });
});
