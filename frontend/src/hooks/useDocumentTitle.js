import { useEffect } from "react";

const BASE_TITLE = "Tu Profesor Particular | Agustin Elias Sosa";
const BASE_DESCRIPTION =
  "Clases particulares personalizadas de matematica, fisica, quimica y mas. Reserva online con confirmacion inmediata. Buenos Aires.";

function setMetaDescription(description) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", description || BASE_DESCRIPTION);
}

/**
 * Sets the document title for the current route.
 * @param {string} [title] - Page-specific title. Appends " | Tu Profesor Particular".
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Tu Profesor Particular` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}

/**
 * Sets both document title and meta description for the current route.
 * @param {string} [title] - Page-specific title.
 * @param {string} [description] - Page-specific meta description.
 */
export function usePageMeta(title, description) {
  useDocumentTitle(title);
  useEffect(() => {
    setMetaDescription(description);
    return () => {
      setMetaDescription(BASE_DESCRIPTION);
    };
  }, [description]);
}
