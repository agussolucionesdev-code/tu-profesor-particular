import { act, render } from "@testing-library/react";
import { memo, useEffect, useState } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { UISettingsProvider, useUISettings } from "../../src/components/accessibility/UISettingsContext";

/* EL CONTEXTO DE PREFERENCIAS NO AVISA CAMBIOS QUE NO HUBO.
 *
 * Antes el valor era un objeto nuevo en cada dibujo del proveedor: al terminar
 * de hidratar la portada (useHidratado pasa a true y el proveedor se redibuja),
 * la barra y el panel de accesibilidad se redibujaban enteros en una tarea
 * sincrónica aunque nada hubiera cambiado. Ahora el valor está memorizado y,
 * si lo guardado es igual a lo de fábrica, se sigue usando el mismo objeto. */

/* jsdom no trae matchMedia: un sistema en claro que no cambia. */
beforeEach(() => {
  window.matchMedia = (consulta) => ({
    matches: false,
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => {
  localStorage.clear();
  delete window.matchMedia;
});

/* El consumidor avisa cada dibujo desde un efecto (corre una vez por dibujo). */
const Consumidor = memo(function Consumidor({ alDibujar }) {
  const valor = useUISettings();
  useEffect(() => {
    alDibujar(valor);
  });
  return null;
});

function Envoltorio({ alDibujar, alArmar }) {
  const [, setVuelta] = useState(0);
  useEffect(() => {
    alArmar(() => setVuelta((v) => v + 1));
  }, [alArmar]);
  return (
    <UISettingsProvider>
      <Consumidor alDibujar={alDibujar} />
    </UISettingsProvider>
  );
}

const armar = () => {
  const cuenta = { dibujos: 0, ultimo: null };
  const alDibujar = (valor) => {
    cuenta.dibujos += 1;
    cuenta.ultimo = valor;
  };
  let forzar;
  render(<Envoltorio alDibujar={alDibujar} alArmar={(f) => (forzar = f)} />);
  return { cuenta, forzar: () => act(() => forzar()) };
};

test("si el proveedor se redibuja sin cambios, quien lo consume no se redibuja", () => {
  const { cuenta, forzar } = armar();
  const dibujosIniciales = cuenta.dibujos;
  forzar();
  forzar();
  expect(cuenta.dibujos).toBe(dibujosIniciales);
});

test("un cambio real sí llega", () => {
  const { cuenta } = armar();
  act(() => cuenta.ultimo.updatePreference("fontScale", "large"));
  expect(cuenta.ultimo.preferences.fontScale).toBe("large");
  act(() => cuenta.ultimo.resetAccessibilityPreferences());
  expect(cuenta.ultimo.preferences.fontScale).toBe("default");
});
