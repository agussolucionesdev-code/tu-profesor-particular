import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

/* `removeBlockedDate` no se importa acá aunque el mock lo define: el componente lo usa
   y por eso tiene que existir en la fábrica del mock, pero estos tests no lo tocan. */
import {
  fetchAdminSchedule,
  fetchBlockedDates,
  updateAdminSchedule,
} from "../../src/api/bookingApi";
import AvailabilitySettingsView from "../../src/components/admin/views/AvailabilitySettingsView";

/* La pantalla de horarios por modalidad, montada de verdad.
 *
 * Los tests de utils prueban el dato y los del backend el camino HTTP. Estos prueban
 * lo único que queda sin cubrir: que el profesor pueda OPERARLA. Un panel puede tener
 * el contrato perfecto y ser inusable —una casilla que no destilda, un campo que no
 * aparece, un guardado que manda otra cosa que lo que se ve en pantalla— y ninguno de
 * los otros tests se enteraría.
 *
 * La verificación visual real la tiene que hacer Agustín entrando al panel: yo no uso
 * sus credenciales. Esto cubre la estructura y la interacción, que es lo que sí puedo
 * probar sin loguearme.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchAdminSchedule: vi.fn(),
  fetchBlockedDates: vi.fn(),
  removeBlockedDate: vi.fn(),
  updateAdminSchedule: vi.fn(),
}));

const authConfig = Object.freeze({ headers: { Authorization: "Bearer test-token" } });

const policy = () => ({
  source: "policy",
  timeZone: "America/Argentina/Buenos_Aires",
  slotDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 60,
  maximumAdvanceDays: 60,
  holidays: [],
  dateExceptions: [],
  blockedIntervals: [],
  weeklyAvailability: Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [
      String(weekday),
      {
        enabled: weekday !== 0,
        intervals: weekday === 0 ? [] : [{ start: "07:00", end: "22:00" }],
        excludedIntervals: [],
      },
    ]),
  ),
});

const respuesta = (extra = {}) => ({
  data: {
    success: true,
    data: {
      revision: 3,
      openingHour: 7,
      closingHour: 22,
      advanceNoticeMinutes: 60,
      slotDurationMinutes: 30,
      timeZone: "America/Argentina/Buenos_Aires",
      activeWeekdays: [1, 2, 3, 4, 5, 6],
      modalityWindows: null,
      modalityChangeBufferMinutes: 45,
      availabilityPolicy: policy(),
      ...extra,
    },
  },
});

const montar = async (extra = {}) => {
  fetchAdminSchedule.mockResolvedValue(respuesta(extra));
  fetchBlockedDates.mockResolvedValue({ data: { success: true, data: [] } });
  render(<AvailabilitySettingsView authConfig={authConfig} />);
  // La tarjeta aparece recién cuando terminó de cargar la configuración.
  await waitFor(() => expect(screen.getByText("Horarios por modalidad")).toBeTruthy());
};

const tarjetaDe = (nombre) => screen.getByRole("group", { name: nombre });

const casillaDe = (nombre) =>
  within(tarjetaDe(nombre)).getByRole("checkbox", { name: /su propio horario/i });

beforeEach(() => {
  updateAdminSchedule.mockResolvedValue(respuesta({ revision: 4 }));
});

describe("estado inicial", () => {
  test("las dos modalidades arrancan siguiendo el horario general", async () => {
    await montar();

    for (const nombre of ["Online", "Presencial"]) {
      expect(casillaDe(nombre).checked).toBe(false);
      expect(within(tarjetaDe(nombre)).getByText(/Usa el horario general/i)).toBeTruthy();
    }
  });

  test("muestra el horario general concreto, no una promesa abstracta", async () => {
    /* "Usa el horario general" sin decir cuál obliga a buscarlo en otra tarjeta. Las
       horas se muestran acá mismo, con dos dígitos. */
    await montar();

    expect(within(tarjetaDe("Presencial")).getByText(/07:00 a 22:00/)).toBeTruthy();
  });

  test("el traslado llega desde el backend, no hardcodeado", async () => {
    await montar({ modalityChangeBufferMinutes: 30 });

    expect(screen.getByLabelText(/Traslado al cambiar de modalidad/i).value).toBe("30");
  });

  test("una modalidad ya recortada aparece con sus horas", async () => {
    await montar({ modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } } });

    const presencial = tarjetaDe("Presencial");
    expect(casillaDe("Presencial").checked).toBe(true);
    expect(within(presencial).getByLabelText("Abre").value).toBe("9");
    expect(within(presencial).getByLabelText("Cierra").value).toBe("21");
    // Y la otra sigue sin recorte: configurar una no puede arrastrar a la otra.
    expect(casillaDe("Online").checked).toBe(false);
  });

  test("avisa que la agenda es una sola", async () => {
    /* Es la regla menos intuitiva del sistema y la que genera el reclamo "¿por qué no
       me deja reservar si estaba libre?". Tiene que estar dicha en la pantalla. */
    await montar();

    expect(screen.getByText(/La agenda sigue siendo una sola/i)).toBeTruthy();
  });
});

describe("operarla", () => {
  test("tildar arranca desde el horario general, sin cambiar nada por accidente", async () => {
    await montar();
    await userEvent.click(casillaDe("Presencial"));

    const presencial = tarjetaDe("Presencial");
    expect(within(presencial).getByLabelText("Abre").value).toBe("7");
    expect(within(presencial).getByLabelText("Cierra").value).toBe("22");
  });

  test("destildar vuelve a seguir el horario general", async () => {
    await montar({ modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } } });
    await userEvent.click(casillaDe("Presencial"));

    expect(within(tarjetaDe("Presencial")).getByText(/Usa el horario general/i)).toBeTruthy();
  });

  test("guarda las horas editadas", async () => {
    await montar();
    await userEvent.click(casillaDe("Presencial"));

    const abre = within(tarjetaDe("Presencial")).getByLabelText("Abre");
    await userEvent.clear(abre);
    await userEvent.type(abre, "9");
    await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(updateAdminSchedule).toHaveBeenCalled());
    const [schedule] = updateAdminSchedule.mock.calls[0];
    expect(schedule.modalityWindows).toEqual({
      presencial: { openingHour: 9, closingHour: 22 },
    });
  });

  test("destildar manda null y no las horas viejas", async () => {
    /* Si mandara las horas, quedarían congeladas contra el horario general y nadie se
       enteraría hasta que el general cambie. */
    await montar({ modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } } });
    await userEvent.click(casillaDe("Presencial"));
    await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(updateAdminSchedule).toHaveBeenCalled());
    expect(updateAdminSchedule.mock.calls[0][0].modalityWindows).toBe(null);
  });

  test("un cierre anterior a la apertura no se guarda y el error se ve", async () => {
    await montar({ modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } } });

    const cierra = within(tarjetaDe("Presencial")).getByLabelText("Cierra");
    await userEvent.clear(cierra);
    await userEvent.type(cierra, "8");
    await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    expect(updateAdminSchedule).not.toHaveBeenCalled();
    expect(await screen.findByText(/posterior a la apertura/i)).toBeTruthy();
  });

  test("borrar una hora no la guarda como medianoche", async () => {
    /* `Number("")` es 0, así que sin validación un campo vacío se guardaba como 00:00 y
       la pantalla decía "guardado". Es el bug que encontró el test de utils. */
    await montar({ modalityWindows: { presencial: { openingHour: 9, closingHour: 21 } } });

    await userEvent.clear(within(tarjetaDe("Presencial")).getByLabelText("Abre"));
    await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    expect(updateAdminSchedule).not.toHaveBeenCalled();
  });
});
