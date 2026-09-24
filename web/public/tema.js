/* Fija el tema en <html> ANTES de la primera pintura.
 *
 * El sitio tiene un botón para elegir claro u oscuro. Si la persona no eligió
 * nada, sigue al sistema. La elección vive en localStorage, y React recién la
 * leería después de pintar: sin este script, quien eligió oscuro vería la
 * página blanca un instante en cada visita.
 *
 * Va en un archivo y no en línea porque la CSP del sitio es `script-src
 * 'self'`: un <script> en línea quedaría bloqueado. Sincrónico, sin defer ni
 * async, y sin imports: corre antes que cualquier otra cosa.
 *
 * Tiene que decidir EXACTAMENTE lo mismo que src/hooks/useTema.js. Lo cuida
 * tests/temaDelSitio.test.js. */
(function () {
  var raiz = document.documentElement;
  var elegido = null;
  try {
    var guardado = window.localStorage.getItem("tpp-tema");
    if (guardado === "light" || guardado === "dark") elegido = guardado;
  } catch {
    /* almacenamiento bloqueado: se sigue al sistema */
  }

  var sistemaOscuro = false;
  try {
    sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    /* sin matchMedia: claro */
  }

  raiz.dataset.theme = elegido || (sistemaOscuro ? "dark" : "light");
  raiz.dataset.themePreference = elegido || "system";
})();
