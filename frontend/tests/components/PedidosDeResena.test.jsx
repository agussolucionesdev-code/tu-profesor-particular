import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchCandidatosAResena, updatePedidoDeResena } from "../../src/api/bookingApi";
import PedidosDeResenaView from "../../src/components/admin/views/PedidosDeResenaView";

/* LA PANTALLA CON LA QUE SE PIDEN LAS RESEÑAS.
 *
 * Los textos del mensaje los fija `tests/unit/pedidoDeResena.test.js`; el backend
 * decide quién entra en la lista y quién no. Estos tests cubren lo que sólo se
 * puede romper acá:
 *
 * 1. Que escribirle a alguien lo MARQUE en el mismo gesto. Si abrir WhatsApp y
 *    registrar el pedido fueran dos acciones separadas, a la tercera semana la
 *    mitad de la lista estaría mal marcada: nadie vuelve al panel a anotar lo que
 *    ya hizo. Es el detalle del que depende que la pantalla siga sirviendo.
 * 2. Que el vacío explique POR QUÉ está vacío. "No hay resultados" a secas deja a
 *    quien lo lee sin saber si está roto o si de verdad no hay nadie.
 * 3. Que a un menor se le muestre el contacto del responsable.
 */

vi.mock("../../src/api/bookingApi", () => ({
  fetchCandidatosAResena: vi.fn(),
  updatePedidoDeResena: vi.fn(),
}));

const CANDIDATO = {
  id: "abc123",
  displayName: "Juan Pérez",
  studentType: "adult",
  contactoNombre: "Juan Pérez",
  esResponsable: false,
  vinculo: "",
  telefono: "+54 9 11 2222-3333",
  telefonoDigits: "541122223333",
  email: "juan@example.com",
  clasesDadas: 6,
  ultimaClase: "2026-08-08T13:00:00.000Z",
  materias: ["Matemática"],
  reviewRequest: { status: "sin pedir", updatedAt: null, notes: "" },
};

const montar = async (candidatos = [CANDIDATO]) => {
  fetchCandidatosAResena.mockResolvedValue({ data: { data: candidatos } });
  updatePedidoDeResena.mockResolvedValue({ data: { data: {} } });
  render(<PedidosDeResenaView authConfig={{ headers: {} }} />);
  await waitFor(() => expect(fetchCandidatosAResena).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("open", vi.fn());
});

describe("la lista", () => {
  test("muestra a cada candidato con cuántas clases hizo", async () => {
    /* El número de clases es el dato que decide a quién escribirle primero: sin
       él, la lista es un directorio y hay que abrir uno por uno. */
    await montar();

    expect(await screen.findByText("Juan Pérez")).toBeTruthy();
    expect(screen.getByText("6 clases")).toBeTruthy();
  });

  test("de un menor muestra al responsable, no al alumno", async () => {
    /* Mandarle un pedido de reseña a un chico de segundo año es, además de
       inútil, incómodo. El nombre grande tiene que ser el de quien recibe. */
    await montar([{
      ...CANDIDATO,
      displayName: "Tomás Álvarez",
      studentType: "minor",
      contactoNombre: "Carolina Álvarez",
      esResponsable: true,
      vinculo: "madre",
    }]);

    expect(await screen.findByText("Carolina Álvarez")).toBeTruthy();
    expect(screen.getByText(/madre de Tomás Álvarez/i)).toBeTruthy();
  });

  test("cuando no hay nadie, explica por qué y qué revisar", async () => {
    await montar([]);

    const vacio = await screen.findByText(/Todavía no hay nadie con dos clases/i);
    expect(vacio).toBeTruthy();
    // Lo accionable: la lista se arma con la asistencia marcada en la agenda.
    expect(within(vacio).getByText("Presente")).toBeTruthy();
  });

  test("sin teléfono no se puede escribir, y se dice", async () => {
    await montar([{ ...CANDIDATO, telefonoDigits: "", telefono: "" }]);

    const boton = await screen.findByRole("button", { name: /Escribirle por WhatsApp/i });
    expect(boton.disabled).toBe(true);
    expect(screen.getByText(/Sin teléfono cargado/i)).toBeTruthy();
  });
});

describe("pedir la reseña", () => {
  test("abre WhatsApp con el mensaje escrito", async () => {
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /Escribirle por WhatsApp/i }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const [url, destino, flags] = window.open.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/541122223333\?text=/);
    expect(decodeURIComponent(url)).toMatch(/Hola Juan/);
    expect(destino).toBe("_blank");
    // Sin `noopener` la pestaña nueva conserva acceso al panel abierto.
    expect(flags).toMatch(/noopener/);
  });

  test("MARCA «pedida» en el mismo gesto, sin un segundo botón", async () => {
    /* El test que sostiene la utilidad de toda la pantalla. Si registrar el pedido
       fuera un paso aparte, a las tres semanas la lista no diría la verdad y
       Agustín volvería a pedirle dos veces a la misma persona. */
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /Escribirle por WhatsApp/i }));

    await waitFor(() => expect(updatePedidoDeResena).toHaveBeenCalledWith(
      "abc123",
      { status: "pedida" },
      expect.anything(),
    ));
  });

  test("después de pedirla sale de la lista", async () => {
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /Escribirle por WhatsApp/i }));

    await waitFor(() => expect(screen.queryByText("Juan Pérez")).toBeNull());
  });
});

describe("cerrar el caso", () => {
  test("«No quiere» se registra y la persona desaparece de la lista", async () => {
    /* Es la acción más importante de la pantalla. Lo que se registra es la
       decisión de la persona, y el backend la respeta para siempre. */
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /No quiere/i }));

    await waitFor(() => expect(updatePedidoDeResena).toHaveBeenCalledWith(
      "abc123",
      { status: "no quiere" },
      expect.anything(),
    ));
    await waitFor(() => expect(screen.queryByText("Juan Pérez")).toBeNull());
  });

  test("«Ya la publiqué» también la cierra", async () => {
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /Ya la publiqué/i }));

    await waitFor(() => expect(updatePedidoDeResena).toHaveBeenCalledWith(
      "abc123",
      { status: "publicada" },
      expect.anything(),
    ));
  });

  test("no manda ningún mensaje al cerrar el caso", async () => {
    // Marcar el estado es una anotación, no un contacto con la persona.
    await montar();

    await userEvent.click(await screen.findByRole("button", { name: /No quiere/i }));

    expect(window.open).not.toHaveBeenCalled();
  });
});

describe("a quien ya se le pidió", () => {
  test("aparece sólo si se pide, y dice hace cuánto fue", async () => {
    const hace60Dias = new Date(Date.now() - 60 * 86400000).toISOString();
    await montar([{
      ...CANDIDATO,
      reviewRequest: { status: "pedida", updatedAt: hace60Dias, notes: "" },
    }]);

    await userEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(fetchCandidatosAResena.mock.lastCall[0]).toEqual(
      { incluirPedidas: "true" },
    ));
    expect(await screen.findByText(/Pedida hace 60 días/i)).toBeTruthy();
    // Pasados los 45 días, insistir es razonable y la pantalla lo dice.
    expect(screen.getByText(/volver a preguntar/i)).toBeTruthy();
  });

  test("recién pedida, la pantalla pide paciencia", async () => {
    const ayer = new Date(Date.now() - 86400000).toISOString();
    await montar([{
      ...CANDIDATO,
      reviewRequest: { status: "pedida", updatedAt: ayer, notes: "" },
    }]);

    expect(await screen.findByText(/Dale tiempo antes de insistir/i)).toBeTruthy();
  });
});

describe("el paso que falta", () => {
  test("dice que sin permiso no se publica", async () => {
    /* La regla que hace que todo esto sea publicable. Está escrita en la pantalla
       donde va a hacer falta: cuando llegue la respuesta, no en un archivo de
       datos que Agustín no abre. */
    await montar();

    expect(await screen.findByText(/Sin ese permiso no se publica/i)).toBeTruthy();
    expect(screen.getByText(/tal cual la escribió/i)).toBeTruthy();
  });
});
