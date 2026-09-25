/* ARRANCA LA APP DESPUÉS DEL PRIMER PINTADO. Sólo en la portada.
 *
 * prerender.mjs lo pone EN LÍNEA en dist/index.html en lugar del script de
 * módulo del bundle, que queda como un modulepreload con id «arranque-app»: el
 * código se descarga desde el principio, pero se ejecuta recién cuando la
 * portada —que ya viene dibujada en el HTML— se vio. (Este comentario no
 * escribe etiquetas: la red del build busca un script de módulo en el HTML.)
 *
 * Medido (septiembre de 2026, sin limitar el CPU): el bundle llegaba antes de
 * que terminara de leerse el HTML y se ejecutaba ahí mismo, una tarea de
 * ~240 ms. El navegador no pintaba hasta terminarla, así que la portada
 * dibujada esperaba al JavaScript igual que sin prerender.
 *
 * Espera a que el HTML esté completo (hidratar un árbol a medio leer no
 * coincide) y a un cuadro pintado: requestAnimationFrame corre antes de pintar
 * y el setTimeout de adentro, después. En una pestaña de fondo no hay cuadros:
 * a los 1,5 s arranca igual.
 *
 * En línea y no en un archivo: la CSP lo autoriza por su hash (vercel.json).
 * Cualquier cambio acá cambia el hash, y el build falla diciendo cuál poner. */
(function () {
  var enlace = document.getElementById("arranque-app");
  if (!enlace) return;

  var arrancado = false;
  var arrancar = function () {
    if (arrancado) return;
    arrancado = true;
    var script = document.createElement("script");
    script.type = "module";
    script.crossOrigin = "";
    script.src = enlace.href;
    document.head.appendChild(script);
  };

  var despuesDelPintado = function () {
    requestAnimationFrame(function () {
      setTimeout(arrancar, 0);
    });
    setTimeout(arrancar, 1500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", despuesDelPintado, { once: true });
  } else {
    despuesDelPintado();
  }
})();
