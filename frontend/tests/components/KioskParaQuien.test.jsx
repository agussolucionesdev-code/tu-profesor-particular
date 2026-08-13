import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchPublicSettings } from "../../src/api/bookingApi";
import BookingKiosk from "../../src/components/BookingKiosk";

/* El recorrido de una abuela reservando para su nieto.
 *
 * El wizard abría con «Tu recorrido empieza acá — ¿Qué nivel estás cursando?»: le
 * hablaba al alumno. Pero reserva una madre, un padre, una hermana mayor, un tío, una
 * abuela. El sistema ya sabía que son dos personas —tiene `studentName` y
 * `responsibleName` por separado— pero lo preguntaba en el PASO 4, con un checkbox.
 * Tres pasos tratando a la abuela como si fuera ella la que cursa el secundario.
 *
 * Estos tests recorren la pantalla como la recorre ella. Los de `kioskVoz.test.js`
 * fijan los textos; estos fijan que el wizard los USE y que la pregunta no sea una
 * trampa sin salida.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchPublicSettings: vi.fn(),
  createBooking: vi.fn(),
  sendSeriesSummary: vi.fn(),
  fetchAvailability: vi.fn(),
}));

/* Un día con un turno, para poder atravesar el paso 3 y llegar al 4.
   El stepper sólo permite volver atrás (`disabled={s.id >= step}`), así que no hay
   atajo: el paso 4 se alcanza recorriendo el flujo como lo recorre una persona. */
const UN_DIA = [{ dateKey: "2026-09-02", slots: [{ timeObj: new Date("2026-09-02T15:00:00.000Z") }] }];

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

/* El calendario se reemplaza por dos botones: su interfaz real (grilla de días,
   franjas, "ver más fechas") tiene sus propios tests, y acá lo único que hace falta es
   cruzar el paso 3.
   Van DOS y no uno porque así funciona de verdad: `onPick` marca el turno y `onConfirm`
   avanza, en interacciones separadas. Encadenarlos en un mismo click no funcionaría
   —`confirmSlot` lee `formData.timeSlot`, que en ese tick todavía está vacío— y ese
   "marcar y después confirmar" es una decisión deliberada del kiosco: antes tocabas una
   hora y la pantalla saltaba sin que llegaras a ver qué habías elegido. */
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("la pregunta abre el wizard", () => {
  test("lo primero que se ve es para quién es la clase, no el nivel", async () => {
    /* El orden importa: de esta respuesta sale el trato de los pasos 1 al 3. Si el
       nivel apareciera primero, ya habría que haber elegido un tratamiento. */
    await montar();

    expect(screen.getByRole("heading", { name: /¿Para quién es la clase\?/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /nivel/i })).toBeNull();
  });

  test("ofrece las dos opciones, con la mayoritaria primero", async () => {
    await montar();

    const botones = screen.getAllByRole("button", { name: /Para (otra persona|mí)/i });
    expect(botones).toHaveLength(2);
    expect(botones[0].textContent).toMatch(/Para otra persona/i);
  });

  test("la opción propia aclara que hay que ser mayor de edad", async () => {
    // La condición estaba en el checkbox viejo y no se puede perder al mover la pregunta.
    await montar();

    expect(screen.getByRole("button", { name: /Para mí.*mayor de edad/i })).toBeTruthy();
  });
});

describe("reservando para otra persona", () => {
  test("el nivel se pregunta en tercera persona", async () => {
    /* El caso textual exacto que motivó el cambio: una abuela no está cursando el
       secundario. */
    await montar();
    await tocar(/Para otra persona/i);

    expect(screen.getByRole("heading", { name: "¿Qué nivel está cursando?" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /¿Qué nivel estás cursando\?/ })).toBeNull();
  });

  test("la materia también, y el paso 4 pide los datos del responsable", async () => {
    await montar();
    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);

    expect(screen.getByRole("heading", { name: "¿Con qué necesita ayuda?" })).toBeTruthy();

    await tocar(/Materia: Matemática/i);
    // Marcar no avanza: cada paso se confirma aparte, por diseno del kiosco.
    await tocar(/Continuar/i);
    await tocar(/^Online./i);
    await tocar(/Continuar/i);
    await tocar(/Marcar turno de prueba/i);
    await tocar(/Confirmar turno de prueba/i);

    // Paso 3 → 4 necesita un turno elegido, así que se salta al 4 por el stepper.
    // Lo que importa acá es que el paso 4 reconozca el rol.
    expect(screen.getByText(/Reservás para otra persona/i)).toBeTruthy();
  });
});

describe("reservando para uno mismo", () => {
  test("el wizard tutea", async () => {
    await montar();
    await tocar(/Para mí/i);

    expect(screen.getByRole("heading", { name: "¿Qué nivel estás cursando?" })).toBeTruthy();
  });
});

describe("la respuesta no es una trampa", () => {
  test("se puede corregir desde el paso 1", async () => {
    /* Sin salida, elegir mal obliga a recargar la página y volver a empezar: no hay
       paso anterior al paso 1 al que volver. */
    await montar();
    await tocar(/Para otra persona/i);
    expect(screen.getByRole("heading", { name: "¿Qué nivel está cursando?" })).toBeTruthy();

    await tocar(/¿Para quién es\?/i);
    expect(screen.getByRole("heading", { name: /¿Para quién es la clase\?/i })).toBeTruthy();

    // Y cambiarla de verdad cambia el trato.
    await tocar(/Para mí/i);
    expect(screen.getByRole("heading", { name: "¿Qué nivel estás cursando?" })).toBeTruthy();
  });
});

describe("el autocompletado apunta a la persona correcta", () => {
  test("reservando para otro, el nombre del alumno no se autocompleta", async () => {
    /* Con `autoComplete="name"` el navegador le ofrece a la abuela SU nombre para el
       campo del nieto: el dato equivocado, en el campo equivocado. */
    await montar();
    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);
    await tocar(/Materia: Matemática/i);
    // Marcar no avanza: cada paso se confirma aparte, por diseno del kiosco.
    await tocar(/Continuar/i);
    await tocar(/^Online./i);
    await tocar(/Continuar/i);
    await tocar(/Marcar turno de prueba/i);
    await tocar(/Confirmar turno de prueba/i);

    const alumno = screen.getByLabelText(/Nombre del alumno/i);
    expect(alumno.getAttribute("autocomplete")).toBe("off");

    const responsable = screen.getByLabelText(/Nombre del responsable/i);
    expect(responsable.getAttribute("autocomplete")).toBe("name");
  });
});
