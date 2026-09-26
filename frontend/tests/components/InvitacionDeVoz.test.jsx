import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { UISettingsProvider } from "../../src/components/accessibility/UISettingsContext";
import Navbar from "../../src/layouts/Navbar";

/* LA INVITACIÓN DE LA GUÍA POR VOZ ESPERA UN GESTO.
 *
 * Salía sola a los 4 s de cargar y, al ser el texto más grande de /reservar,
 * el navegador la tomaba como el contenido principal: Lighthouse con red y CPU
 * limitados de verdad midió LCP 7,2 s por ella (septiembre de 2026). El
 * navegador deja de medir el LCP con la primera interacción, así que ahora la
 * invitación espera un toque, una tecla o un desplazamiento, y sigue sin salir
 * antes de los 4 s. */

const INVITACION = /¿Querés que te guíe hablando\?/;
const invitacion = () => screen.queryByText(INVITACION);
const avanzar = (ms) => act(() => vi.advanceTimersByTime(ms));
const gesto = (tipo = "pointerdown") => act(() => window.dispatchEvent(new Event(tipo)));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.matchMedia = (consulta) => ({
    matches: false,
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  delete window.matchMedia;
});

let inicio = 0;
const montar = () => {
  inicio = Date.now();
  return render(
    <UISettingsProvider>
      <MemoryRouter initialEntries={["/reservar"]}>
        <Navbar />
      </MemoryRouter>
    </UISettingsProvider>,
  );
};

test("sin ningún gesto no aparece nunca, ni a los 4 s ni en las repeticiones", () => {
  montar();
  /* Mirar sólo al final no alcanza: cada invitación se oculta sola a los 15 s.
     Se mira en cada momento en que la versión anterior la mostraba (4 s y cada
     3 minutos). */
  for (const momento of [4_500, 180_500, 360_500, 540_500]) {
    avanzar(momento - Date.now() + inicio);
    expect(invitacion(), `a los ${momento} ms`).toBeNull();
  }
});

test("con un gesto temprano, aparece recién a los 4 s de haber entrado", () => {
  montar();
  avanzar(500);
  gesto("pointerdown");
  avanzar(3000);
  expect(invitacion()).toBeNull();
  avanzar(600);
  expect(invitacion()).toBeInTheDocument();
});

test("con un gesto tardío, aparece un momento después, no en el mismo instante del toque", () => {
  montar();
  avanzar(10_000);
  gesto("keydown");
  avanzar(700);
  expect(invitacion()).toBeNull();
  avanzar(200);
  expect(invitacion()).toBeInTheDocument();
});

test("desplazar la página también cuenta como gesto", () => {
  montar();
  gesto("scroll");
  avanzar(4100);
  expect(invitacion()).toBeInTheDocument();
});

test("con la guía ya activada, no invita", () => {
  localStorage.setItem("muted_alerts", "false");
  montar();
  gesto("pointerdown");
  avanzar(10_000);
  expect(invitacion()).toBeNull();
});
