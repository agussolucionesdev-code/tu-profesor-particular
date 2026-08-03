import { useEffect } from "react";
import { IMAGEN_POR_DEFECTO, META_POR_RUTA, urlDe } from "../data/meta.js";

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
 * Los textos salen de data/meta.js, el mismo módulo que lee el script de
 * prerender. Así el HTML servido y lo que escribe React dicen lo mismo por
 * construcción, no por disciplina.
 *
 * Se pasa la RUTA, no los textos: si además hubiera que pasarlos, cada página
 * podría escribir algo distinto de lo que el build ya dejó en el HTML, y el
 * único síntoma sería una vista previa de WhatsApp que no coincide con la
 * pestaña. Con la ruta como única entrada, esa divergencia no puede existir.
 */
export default function usePageMeta(ruta, opciones = {}) {
  const { image, meta } = opciones;

  useEffect(() => {
    const datos = meta ?? META_POR_RUTA[ruta];
    if (!datos) return;

    const { title, description } = datos;
    if (title) document.title = title;

    if (description) {
      fijarEtiqueta('meta[name="description"]', {
        crearCon: { name: "description" },
        campo: "content",
        valor: description,
      });
    }

    const url = urlDe(ruta);
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
  }, [ruta, image, meta]);
}
