import { useSyncExternalStore } from "react";

/* ¿YA TERMINÓ DE HIDRATAR?
 *
 * La portada llega prerenderizada (prerender.mjs) y React la HIDRATA: adopta
 * los nodos que ya están en vez de reemplazarlos, así las animaciones de
 * entrada no vuelven a arrancar. Para eso el primer dibujo del navegador tiene
 * que ser IGUAL al HTML, y el HTML se hizo sin localStorage ni matchMedia.
 *
 * `false` en el servidor y durante la hidratación; `true` enseguida después
 * (React vuelve a dibujar solo cuando cambia). En una ruta que no hidrata
 * —createRoot— es `true` desde el primer dibujo.
 *
 * Quien dibuja algo que sale del navegador (tema, voz, preferencias, un
 * contador) muestra lo del servidor mientras sea `false`. Es el mismo recurso
 * que usa el sitio para el tema (web/src/hooks/useTema.js). */
const sinCambios = () => () => {};

export const useHidratado = () =>
  useSyncExternalStore(
    sinCambios,
    () => true,
    () => false,
  );
