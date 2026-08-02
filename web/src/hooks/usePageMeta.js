import { useEffect } from "react";

const SITIO = "https://tuprofesorparticular.com.ar";
/* Imagen que se ve al compartir el enlace. Se referencia por URL absoluta y
   vive en /public: los crawlers la piden por HTTP, no resuelven imports. */
const IMAGEN_POR_DEFECTO = `${SITIO}/og-cover.png`;

/* Escribe o actualiza una etiqueta del <head>, creándola si no existe: así
   sumar un metadato nuevo no obliga a tocar también el index.html. */
const fijarEtiqueta = (selector, { crearCon, campo, valor }) => {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement(selector.startsWith("link") ? "link" : "meta");
    for (const [k, v] of Object.entries(crearCon)) tag.setAttribute(k, v);
    document.head.appendChild(tag);
  }
  tag.setAttribute(campo, valor);
};

/**
 * Metadatos por página: título, descripción, canonical y tarjetas sociales.
 *
 * Antes sólo tocaba el <title> y la description. El canonical y el bloque
 * Open Graph quedaban congelados en los valores del index.html: las seis rutas
 * le declaraban a Google ser la portada, y compartir /materias por WhatsApp
 * mostraba el texto de la portada.
 *
 * Alcance real, para no prometer de más: los bots de WhatsApp, Facebook y
 * LinkedIn NO ejecutan JavaScript, así que leen el HTML servido. Esto corrige
 * el canonical y el OG para Google —que sí ejecuta JS— y deja las etiquetas
 * bien puestas en el DOM; la vista previa al compartir queda del todo resuelta
 * recién cuando el sitio se prerenderice.
 */
export default function usePageMeta(title, description, opciones = {}) {
  const { path, image } = opciones;

  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      fijarEtiqueta('meta[name="description"]', {
        crearCon: { name: "description" },
        campo: "content",
        valor: description,
      });
    }

    const ruta = path ?? window.location.pathname;
    const url = ruta === "/" ? `${SITIO}/` : `${SITIO}${ruta}`;
    const imagen = image ?? IMAGEN_POR_DEFECTO;

    fijarEtiqueta('link[rel="canonical"]', {
      crearCon: { rel: "canonical" },
      campo: "href",
      valor: url,
    });

    const porPropiedad = [
      ["og:title", title],
      ["og:description", description],
      ["og:url", url],
      ["og:image", imagen],
    ];
    for (const [propiedad, valor] of porPropiedad) {
      if (!valor) continue;
      fijarEtiqueta(`meta[property="${propiedad}"]`, {
        crearCon: { property: propiedad },
        campo: "content",
        valor,
      });
    }

    const porNombre = [
      ["twitter:card", "summary_large_image"],
      ["twitter:title", title],
      ["twitter:description", description],
      ["twitter:image", imagen],
    ];
    for (const [nombre, valor] of porNombre) {
      if (!valor) continue;
      fijarEtiqueta(`meta[name="${nombre}"]`, {
        crearCon: { name: nombre },
        campo: "content",
        valor,
      });
    }
  }, [title, description, path, image]);
}
