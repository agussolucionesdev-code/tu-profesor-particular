import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getManagedBooking } from "../../src/api/bookingApi";
import { clasificarFalla } from "../../src/api/errorClassification";
import ManageBooking from "../../src/components/ManageBooking";

vi.mock("../../src/api/bookingApi", () => ({
  getManagedBooking: vi.fn(),
  cancelBooking: vi.fn(),
  revokeManagementAccess: vi.fn(),
}));

/* La pantalla del enlace de gestión, y la distinción que le faltaba.
 *
 * Hacía `catch { setState("invalid") }`: CUALQUIER error terminaba en "Enlace no
 * disponible — este enlace venció, fue revocado o no es válido". A quien se le
 * cortaba el wifi la app le decía que su enlace no servía. Y el enlace estaba
 * perfecto: recargando entraba. Pero para entonces ya había ido a pedir otro.
 *
 * Estos tests son el contrato de esa distinción, y están acá y no en el
 * navegador por una razón concreta: la ruta es `lazy()`, así que parchear el XHR
 * antes de que cargue el chunk es una carrera. Acá el fallo se provoca de forma
 * determinista, y queda corriendo en CI para siempre. */

// 43 caracteres: es lo que exige TOKEN_PATTERN en el componente.
const TOKEN = "a".repeat(43);

const errorDeRed = () => {
  const error = Object.assign(new Error("Network Error"), {
    isAxiosError: true,
    code: "ERR_NETWORK",
    request: {},
  });
  // Lo adjunta el interceptor de apiClient; acá se replica porque el módulo
  // está mockeado y el interceptor no corre.
  error.falla = clasificarFalla(error);
  return error;
};

const errorHttp = (status, message) => {
  const error = Object.assign(new Error(`Request failed with status ${status}`), {
    isAxiosError: true,
    response: { status, data: message ? { message } : {} },
  });
  error.falla = clasificarFalla(error);
  return error;
};

const turno = {
  bookingCode: "ABC234",
  studentName: "Alumna De Prueba",
  subject: "Matemática",
  educationLevel: "Secundaria",
  status: "Confirmado",
  timeSlot: "2099-08-10T15:00:00.000Z",
  endTime: "2099-08-10T16:00:00.000Z",
  duration: 1,
};

const montar = () =>
  render(
    <MemoryRouter>
      <ManageBooking />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  // El componente lee el token del fragmento y lo borra del historial.
  window.location.hash = `#token=${TOKEN}`;
});

afterEach(() => {
  window.location.hash = "";
});

describe("cuando el problema es la red", () => {
  test("NO dice que el enlace no sirve", async () => {
    getManagedBooking.mockRejectedValue(errorDeRed());

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent(
        "No pudimos cargar tu turno",
      ),
    );
    expect(screen.queryByText(/Enlace no disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/venció, fue revocado/i)).not.toBeInTheDocument();
  });

  test("le dice explícitamente que su enlace sigue sirviendo", async () => {
    // Es la mitad que importa: sin esta frase la persona igual sospecha del
    // enlace y va a pedir otro.
    getManagedBooking.mockRejectedValue(errorDeRed());

    montar();

    await waitFor(() =>
      expect(screen.getByText(/tu enlace sigue siendo válido/i)).toBeInTheDocument(),
    );
  });

  test("ofrece reintentar y el reintento vuelve a pedir el turno", async () => {
    getManagedBooking
      .mockRejectedValueOnce(errorDeRed())
      .mockResolvedValueOnce({ data: { data: turno } });

    montar();

    const reintentar = await screen.findByRole("button", { name: /probar de nuevo/i });
    await userEvent.click(reintentar);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Gestioná tu turno",
      ),
    );
    expect(getManagedBooking).toHaveBeenCalledTimes(2);
    // El mismo token: reintentar no puede obligar a conseguir otro.
    expect(getManagedBooking).toHaveBeenNthCalledWith(2, TOKEN);
  });

  test("anuncia el problema por aria-live, no solo en pantalla", async () => {
    getManagedBooking.mockRejectedValue(errorDeRed());

    montar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/conexión/i);
  });

  test("un timeout dice que el servidor tarda, no que el enlace falló", async () => {
    /* El backend está en el plan gratuito de Render: se duerme sin tráfico y el
       primer pedido puede pasarse del timeout de 15 segundos. Es la causa más
       probable de este error en producción. */
    const error = Object.assign(new Error("timeout"), {
      isAxiosError: true,
      code: "ECONNABORTED",
      request: {},
    });
    error.falla = clasificarFalla(error);
    getManagedBooking.mockRejectedValue(error);

    montar();

    expect(await screen.findByRole("alert")).toHaveTextContent(/tard/i);
  });

  test("un 500 tampoco culpa al enlace", async () => {
    getManagedBooking.mockRejectedValue(errorHttp(503));

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent(
        "No pudimos cargar tu turno",
      ),
    );
  });
});

describe("cuando el problema sí es el token", () => {
  test("un 401 manda a pedir un enlace nuevo", async () => {
    getManagedBooking.mockRejectedValue(errorHttp(401));

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent("Enlace no disponible"),
    );
    expect(screen.queryByRole("button", { name: /probar de nuevo/i })).not.toBeInTheDocument();
  });

  test("un 403 hace lo mismo", async () => {
    getManagedBooking.mockRejectedValue(errorHttp(403));

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent("Enlace no disponible"),
    );
  });

  test("un 404 también, y NO ofrece reintentar", async () => {
    // Reintentar un código que no existe deja a la persona apretando un botón
    // para siempre.
    getManagedBooking.mockRejectedValue(errorHttp(404));

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent("Enlace no disponible"),
    );
    expect(screen.queryByRole("button", { name: /probar de nuevo/i })).not.toBeInTheDocument();
  });
});

describe("borde", () => {
  test("sin token en el fragmento no llama a la API", async () => {
    window.location.hash = "";

    montar();

    await waitFor(() =>
      expect(screen.getByRole("heading")).toHaveTextContent("Enlace no disponible"),
    );
    expect(getManagedBooking).not.toHaveBeenCalled();
  });

  test("una cancelación por desmontaje no pinta ninguna pantalla de error", async () => {
    /* Si alguien navega antes de que termine el pedido, axios lanza un
       CanceledError. Mostrarlo sería un cartel rojo por haber cambiado de
       página. */
    const error = Object.assign(new Error("canceled"), {
      isAxiosError: true,
      code: "ERR_CANCELED",
    });
    error.falla = clasificarFalla(error);
    getManagedBooking.mockRejectedValue(error);

    montar();

    // Se queda en "Verificando…", que es la verdad: nunca terminó.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/verificando/i),
    );
    expect(screen.queryByText(/Enlace no disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar/i)).not.toBeInTheDocument();
  });
});
