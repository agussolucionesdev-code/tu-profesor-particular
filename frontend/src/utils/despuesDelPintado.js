/* RESUELVE DESPUÉS DEL PRÓXIMO PINTADO.
 *
 * requestAnimationFrame corre justo ANTES de pintar un cuadro; el setTimeout de
 * adentro, después. Es la forma de decir «primero mostrá lo que ya tenés,
 * después seguí». Mismo recurso que scripts/arranque-en-linea.js.
 *
 * Sin cuadros no espera de más: en Node (el prerender) no hay
 * requestAnimationFrame y resuelve enseguida; en una pestaña de fondo, donde
 * no se pinta, el respaldo la resuelve igual a los 500 ms. */
export const despuesDelPintado = () =>
  new Promise((listo) => {
    if (typeof requestAnimationFrame !== "function") {
      listo();
      return;
    }
    let hecho = false;
    const terminar = () => {
      if (hecho) return;
      hecho = true;
      listo();
    };
    requestAnimationFrame(() => setTimeout(terminar, 0));
    setTimeout(terminar, 500);
  });
