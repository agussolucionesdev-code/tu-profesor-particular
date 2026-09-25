/* Fija el tema en <html> ANTES de la primera pintura.
 *
 * React aplica el tema en un efecto, después de pintar. Sin este script, quien
 * tiene el sistema en oscuro vería la página blanca un instante y después el
 * salto.
 *
 * En el sitio publicado va EN LÍNEA: prerender.mjs lo copia adentro de un
 * <script> (como archivo costaba un viaje de red antes de poder pintar) y la
 * CSP, que es `script-src 'self'`, lo autoriza por su hash en vercel.json.
 * Cualquier cambio acá —comentarios incluidos— cambia el hash: el build falla
 * y dice cuál poner. En desarrollo se carga como archivo (index.html).
 *
 * Tiene que decidir EXACTAMENTE lo mismo que UISettingsContext.jsx. Si el
 * script dijera «oscuro» y React arrancara en «claro», el efecto de React
 * pisaría al script y volvería el destello. Lo cuida
 * tests/unit/temaDelSistema.test.js.
 *
 * Sin módulos ni imports: corre antes que cualquier otra cosa y sin pasar por
 * el bundler, así que no puede depender de nada. */
(function () {
  var VERSION = 2;
  var raiz = document.documentElement;

  var sistemaOscuro = false;
  try {
    sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    /* sin matchMedia: claro */
  }

  var preferencia = "system";
  try {
    var crudo = window.localStorage.getItem("ui_accessibility_preferences");
    var guardado = crudo ? JSON.parse(crudo) : null;
    var valido = function (t) { return t === "light" || t === "dark" || t === "system"; };
    var tema = guardado && guardado.themePreference;
    var version = guardado && guardado.version;
    /* Mismo orden que React: si las preferencias no traen un tema válido, se
       cae a la clave vieja `theme`, que nunca tuvo versión. */
    if (!valido(tema)) {
      tema = window.localStorage.getItem("theme");
      version = undefined;
    }

    if (valido(tema)) {
      /* LA MIGRACIÓN. El código anterior escribía las preferencias en cada
         visita con «claro» por defecto, así que un «claro» guardado sin marca de
         versión lo puso el sistema, no la persona. Un «oscuro» sí lo eligió
         alguien: nunca fue el valor por defecto. */
      preferencia = tema === "light" && version !== VERSION ? "system" : tema;
    }
  } catch {
    /* almacenamiento bloqueado o JSON roto: se sigue al sistema */
  }

  var efectivo = preferencia === "system" ? (sistemaOscuro ? "dark" : "light") : preferencia;
  raiz.dataset.theme = efectivo;
  raiz.dataset.themePreference = preferencia;
})();
