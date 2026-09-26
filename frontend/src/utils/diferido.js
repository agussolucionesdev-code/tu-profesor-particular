import { createElement, lazy } from "react";
import { despuesDelPintado } from "./despuesDelPintado";

/* UN COMPONENTE DIFERIDO QUE SE PUEDE PEDIR POR ADELANTADO.
 *
 * React.lazy sola suspende en el primer dibujo AUNQUE el módulo ya haya
 * llegado: recién ahí mira la promesa, y React 19 además retiene el contenido
 * ~300 ms detrás del fallback. Precargar no alcanzaba: igual se veía el
 * recuadro de espera.
 *
 * `diferido` guarda el módulo cuando llega. Si ya está, dibuja el componente
 * directo, sin Suspense; si no, pasa por el lazy como siempre. `precargar()`
 * lo pide antes de que haga falta.
 *
 * Lo usan las pantallas (src/paginas.js, precargadas antes del primer dibujo)
 * y el calendario del kiosco (pedido desde el paso 2).
 *
 * CUANDO SE PIDE AL DIBUJAR (el lazy), primero deja pintar lo que ya hay. En
 * /reservar la barra con el logo —el elemento LCP— se dibuja junto con el
 * cargador, y el código del kiosco se pide recién después de ese pintado.
 * Medido (septiembre de 2026, 15 corridas de Lighthouse): si el código llegaba
 * y se ejecutaba antes de que el navegador pintara la barra, el LCP pasaba de
 * ~2,75 s a ~3,35-3,6 s, y eso pasaba en 2 de cada 3 cargas. Cuesta un cuadro
 * (~16 ms). `precargar()` no espera: se usa cuando ya hay algo pintado. */
export const diferido = (cargar) => {
  let modulo = null;
  const traer = () =>
    cargar().then((m) => {
      modulo = m;
      return m;
    });
  const Diferido = lazy(() => despuesDelPintado().then(traer));
  const Componente = (props) => createElement(modulo ? modulo.default : Diferido, props);
  Componente.precargar = traer;
  return Componente;
};
