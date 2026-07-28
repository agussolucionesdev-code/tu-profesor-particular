import { useEffect } from "react";

/**
 * Título y descripción por página. Es una SPA, así que el <title> y la meta
 * description se actualizan al navegar (importa para pestañas, historial,
 * compartir enlaces y buscadores).
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}
