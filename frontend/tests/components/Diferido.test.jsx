import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { despuesDelPintado } from "../../src/utils/despuesDelPintado";
import { diferido } from "../../src/utils/diferido";

/* LA PANTALLA DIFERIDA DEJA PINTAR ANTES DE PEDIR SU CÓDIGO.
 *
 * En /reservar la barra con el logo es el elemento LCP y se dibuja junto con el
 * cargador. Si el código del kiosco llegaba y se ejecutaba antes de que el
 * navegador pintara ese cuadro, el LCP pasaba de ~2,75 s a ~3,35-3,6 s (15
 * corridas de Lighthouse, septiembre de 2026). Acá los cuadros y los tiempos
 * están bajo control: requestAnimationFrame corre antes de pintar, el
 * setTimeout de adentro, después. */

let cuadros;

beforeEach(() => {
  vi.useFakeTimers();
  cuadros = [];
  vi.stubGlobal("requestAnimationFrame", (fn) => cuadros.push(fn));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const unaPantalla = () => {
  const cargar = vi.fn(() => Promise.resolve({ default: () => <p>la pantalla</p> }));
  return { cargar, Pantalla: diferido(cargar) };
};

const dibujar = (componente) => {
  const Pantalla = componente;
  return render(
    <Suspense fallback={<p>cargando</p>}>
      <Pantalla />
    </Suspense>,
  );
};

test("dibujada por el lazy, primero se pinta el cargador y recién después se pide el código", async () => {
  const { cargar, Pantalla } = unaPantalla();
  dibujar(Pantalla);
  expect(screen.getByText("cargando")).toBeInTheDocument();
  expect(cargar).not.toHaveBeenCalled();

  /* requestAnimationFrame: todavía no se pintó. */
  await act(async () => cuadros.shift()());
  expect(cargar).not.toHaveBeenCalled();

  /* El setTimeout de adentro corre después del pintado. */
  await act(async () => vi.advanceTimersByTimeAsync(0));
  expect(cargar).toHaveBeenCalledTimes(1);

  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText("la pantalla")).toBeInTheDocument();
});

test("precargar() no espera ningún cuadro, y después se dibuja directo", async () => {
  const { cargar, Pantalla } = unaPantalla();
  await Pantalla.precargar();
  expect(cargar).toHaveBeenCalledTimes(1);
  expect(cuadros).toHaveLength(0);

  dibujar(Pantalla);
  expect(screen.getByText("la pantalla")).toBeInTheDocument();
  expect(screen.queryByText("cargando")).toBeNull();
  expect(cargar).toHaveBeenCalledTimes(1);
});

test("en una pestaña de fondo, sin cuadros, la pide igual a los 500 ms", async () => {
  const { cargar, Pantalla } = unaPantalla();
  dibujar(Pantalla);
  await act(async () => vi.advanceTimersByTimeAsync(499));
  expect(cargar).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(cargar).toHaveBeenCalledTimes(1);
});

test("sin requestAnimationFrame (el prerender, en Node) no espera", async () => {
  vi.stubGlobal("requestAnimationFrame", undefined);
  let listo = false;
  despuesDelPintado().then(() => {
    listo = true;
  });
  await Promise.resolve();
  expect(listo).toBe(true);
});
