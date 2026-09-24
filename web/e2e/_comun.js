/* Lo que comparten los specs del sitio. */

/* Las rutas públicas: las mismas claves que META_POR_RUTA (src/data/meta.js),
   que es de donde salen el prerender y el sitemap. */
export const RUTAS = ["/", "/sobre-mi", "/materias", "/como-trabajo", "/contacto", "/privacidad"];
export const TEMAS = ["light", "dark"];

/* Fija el tema como lo haría el botón de la barra: la elección vive en
   localStorage y `public/tema.js` la aplica antes de pintar. */
export const conTema = async (page, tema) => {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("tpp-tema", t);
    } catch {
      /* sin almacenamiento: queda el tema del sistema */
    }
  }, tema);
};

/* Muestra lo que el reveal esconde hasta hacer scroll, para medirlo todo. */
export const revelarTodo = async (page) => {
  await page.addStyleTag({
    content: `*{transition:none!important;animation:none!important}
      [data-reveal],[data-entrada]{opacity:1!important;transform:none!important;clip-path:none!important}`,
  });
  await page.evaluate(() => void document.body.offsetHeight);
};
