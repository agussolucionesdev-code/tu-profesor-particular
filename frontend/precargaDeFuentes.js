/* Precarga de las dos fuentes que pinta la primera pantalla.
 *
 * Las fuentes viajan dentro del CSS (@fontsource), así que el navegador las
 * descubre recién después de bajar y leer la hoja de estilos: primero pinta el
 * título en la fuente de reserva y después salta a Fraunces. Lighthouse midió
 * ese salto en la portada (CLS de `.hp-hero-body` atribuido a las dos fuentes).
 * Con `<link rel="preload">` el pedido sale apenas se lee el HTML.
 *
 * Sólo las dos latinas que usa el primer pliegue —Fraunces (títulos) e Inter
 * (texto)—: precargar todas competiría por el ancho de banda con lo que sí
 * hace falta. Los nombres llevan el hash del build, por eso se buscan en el
 * bundle; si @fontsource los cambia, el build FALLA en vez de precargar un
 * archivo que no existe. El sitio institucional hace lo mismo en su prerender.
 */
export const FUENTES_CRITICAS = [
  /(^|\/)fraunces-latin-opsz-normal-[\w-]+\.woff2$/,
  /(^|\/)inter-latin-wght-normal-[\w-]+\.woff2$/,
];

export const enlacesDePrecarga = (archivos) =>
  FUENTES_CRITICAS.map((patron) => {
    const archivo = archivos.find((nombre) => patron.test(nombre));
    if (!archivo) {
      throw new Error(`precargaDeFuentes: no encontré ${patron} en el build. ¿Cambió el nombre en @fontsource?`);
    }
    return {
      tag: "link",
      attrs: { rel: "preload", href: `/${archivo}`, as: "font", type: "font/woff2", crossorigin: "" },
      injectTo: "head",
    };
  });

export default function precargaDeFuentes() {
  return {
    name: "tpp-precarga-de-fuentes",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (_html, { bundle }) => (bundle ? enlacesDePrecarga(Object.keys(bundle)) : []),
    },
  };
}
