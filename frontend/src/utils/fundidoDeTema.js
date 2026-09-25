/* El cambio de tema se abre como un círculo que nace del botón.
 *
 * Usa la View Transitions API: el navegador fotografía la página vieja y la
 * nueva, y el CSS (`html[data-cambio-de-tema]::view-transition-new(root)` en
 * styles/motion-system.css) anima la nueva con un `clip-path: circle()` que crece desde el
 * punto del clic hasta la esquina más lejana. Donde la API no existe, o si la
 * persona pidió menos movimiento, el tema cambia al instante.
 *
 * Con teclado (Enter o Espacio) el evento no trae coordenadas: el círculo nace
 * del centro del botón.
 *
 * Hay una copia igual en web/src/lib/fundidoDeTema.js: son dos bundles
 * separados que no pueden importarse entre sí.
 */
export function conFundidoCircular(evento, cambiar) {
  const quieta = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (typeof document.startViewTransition !== "function" || quieta) {
    cambiar();
    return;
  }

  let x = evento?.clientX ?? 0;
  let y = evento?.clientY ?? 0;
  if ((!x && !y) || evento?.detail === 0) {
    const caja = evento?.currentTarget?.getBoundingClientRect?.();
    x = caja ? caja.left + caja.width / 2 : window.innerWidth / 2;
    y = caja ? caja.top + caja.height / 2 : 0;
  }
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const raiz = document.documentElement;
  raiz.style.setProperty("--tema-x", `${x}px`);
  raiz.style.setProperty("--tema-y", `${y}px`);
  raiz.style.setProperty("--tema-radio", `${Math.ceil(radio)}px`);
  raiz.dataset.cambioDeTema = "";

  const transicion = document.startViewTransition(cambiar);
  transicion.finished.finally(() => {
    delete raiz.dataset.cambioDeTema;
  });
}
