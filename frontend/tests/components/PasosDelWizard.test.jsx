import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchPublicSettings } from "../../src/api/bookingApi";
import BookingKiosk from "../../src/components/BookingKiosk";

/* IR Y VOLVER ENTRE PASOS.
 *
 * Dos cosas que el wizard hacía a medias.
 *
 * 1. La animación de entrada del paso era siempre la misma, fuera para adelante
 *    o para atrás. Un movimiento que no distingue dirección no informa nada: la
 *    persona no sabe si avanzó o retrocedió, y en un formulario de cinco pasos
 *    eso se nota. Ahora el panel entra desde la derecha al avanzar y desde la
 *    izquierda al volver, que es el sentido en que se lee.
 *
 * 2. Volver a un paso terminado SE PODÍA —los pasos del indicador de arriba son
 *    botones y los ya hechos están habilitados— pero nada lo decía. El botón se
 *    llamaba «Materia» a secas, así que ni se veía ni se escuchaba que sirviera
 *    para volver.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchPublicSettings: vi.fn(),
  createBooking: vi.fn(),
  sendSeriesSummary: vi.fn(),
  fetchAvailability: vi.fn(),
}));

vi.mock("../../src/hooks/useBookingAvailability", () => ({
  useBookingAvailability: () => ({
    upcomingSlotsByDay: [],
    availabilityStatus: "ready",
    availabilityMatchesSelectedDuration: true,
    isSelectedTimeVerified: true,
    maxAllowedDuration: 3,
    retryAvailability: vi.fn(),
  }),
}));

vi.mock("../../src/components/KioskSlotCalendar", () => ({
  default: () => null,
}));

const tocar = (nombre) => userEvent.click(screen.getByRole("button", { name: nombre }));

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

const tarjeta = () => document.querySelector(".kiosk-card");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("la animación dice para qué lado se va", () => {
  test("al avanzar entra desde adelante", async () => {
    await montar();
    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);
    await tocar(/Materia: Matemática/i);
    await tocar(/^Continuar$/i);

    expect(tarjeta().getAttribute("data-direccion")).toBe("adelante");
  });

  test("al volver a un paso anterior, entra desde atrás", async () => {
    await montar();
    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);
    await tocar(/Materia: Matemática/i);
    await tocar(/^Continuar$/i);

    await tocar(/Volver al paso 1: Materia/i);

    expect(tarjeta().getAttribute("data-direccion")).toBe("atras");
  });
});

describe("se nota que se puede volver", () => {
  test("cada paso terminado dice que sirve para volver", async () => {
    /* El nombre accesible es lo único que oye quien usa lector de pantalla, y
       también lo que ve quien deja el puntero encima. «Materia» a secas no
       dice que se pueda tocar para corregir. */
    await montar();
    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);
    await tocar(/Materia: Matemática/i);
    await tocar(/^Continuar$/i);

    expect(screen.getByRole("button", { name: "Volver al paso 1: Materia" })).toBeTruthy();
  });

  test("los pasos que faltan no se anuncian como algo a tocar", async () => {
    await montar();

    const turno = screen.getByRole("button", { name: /Turno/ });
    expect(turno.hasAttribute("disabled")).toBe(true);
    expect(turno.getAttribute("aria-label")).toBeNull();
  });

  test("el aviso de que se puede volver aparece recién cuando hay a dónde volver", async () => {
    await montar();
    expect(screen.queryByText(/Tocá un paso terminado/i)).toBeNull();

    await tocar(/Para otra persona/i);
    await tocar(/Secundaria\. 1° a 6° año/i);
    await tocar(/Materia: Matemática/i);
    await tocar(/^Continuar$/i);

    expect(screen.getByText(/Tocá un paso terminado para volver/i)).toBeTruthy();
  });
});
