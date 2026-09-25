import { createElement, lazy } from "react";

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
 * y el calendario del kiosco (pedido desde el paso 2). */
export const diferido = (cargar) => {
  let modulo = null;
  const traer = () =>
    cargar().then((m) => {
      modulo = m;
      return m;
    });
  const Diferido = lazy(traer);
  const Componente = (props) => createElement(modulo ? modulo.default : Diferido, props);
  Componente.precargar = traer;
  return Componente;
};
