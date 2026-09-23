import { useEffect } from "react";

const BASE_TITLE = "Tu Profesor Particular | Agustín Elías Sosa";
const BASE_DESCRIPTION =
  "Clases particulares personalizadas de matemática, física, química y más. Reservá online con confirmación inmediata. Buenos Aires.";

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

/* El catch-all de `vercel.json` manda cualquier ruta desconocida al index.html,
   así que una URL que no existe responde 200 y no 404. Para un buscador eso es
   un "soft 404": una página de error que se presenta como una página válida, y
   es candidata a terminar indexada.

   El arreglo de fondo sería enumerar las rutas en los rewrites para que el resto
   caiga en el 404 nativo de Vercel. No se hace acá a propósito: ese catch-all ya
   costó un bug caro —se comía `/_vercel/insights/script.js` y dejó la analítica
   muerta durante meses— y, como explica `vercelPreviewProxy.test.js`, no hay
   forma de verificar un cambio de routing antes de que llegue a producción,
   porque los deployments de preview están detrás del login de Vercel.

   `noindex` resuelve lo que importa —que la página no se indexe— sin tocar el
   routing. */
function setRobots(noindex) {
  let tag = document.querySelector('meta[name="robots"]');
  if (!noindex) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "robots");
    document.head.appendChild(tag);
  }
  /* `follow` y no `nofollow`: la página no se indexa, pero los enlaces que
     ofrece —volver a reservar, ver mis turnos— sí se siguen. */
  tag.setAttribute("content", "noindex, follow");
}

const HOST = "https://turnos.tuprofesorparticular.com.ar";

/* La URL canónica de la ruta actual. El `index.html` trae la de la portada; sin
   esto, /reservar y /portal heredaban esa y le decían a Google que eran la
   portada. Se usa el pathname SIN query: /reservar?materia=Química no es otra
   página, es la misma con una materia preseleccionada.

   Una página con `noindex` no declara canónica: pedir que no se indexe y a la
   vez nombrarse original son dos señales que se contradicen. */
function setCanonical(pathname) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!pathname) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", `${HOST}${pathname}`);
}

/**
 * Sets both document title and meta description for the current route.
 * @param {string} [title] - Page-specific title.
 * @param {string} [description] - Page-specific meta description.
 * @param {{noindex?: boolean}} [options] - `noindex: true` para páginas que no
 *   son contenido, como el 404.
 */
export function usePageMeta(title, description, options = {}) {
  const { noindex = false } = options;
  useDocumentTitle(title);
  useEffect(() => {
    setMetaDescription(description);
    return () => {
      setMetaDescription(BASE_DESCRIPTION);
    };
  }, [description]);
  useEffect(() => {
    setRobots(noindex);
    return () => {
      setRobots(false);
    };
  }, [noindex]);
  useEffect(() => {
    setCanonical(noindex ? null : window.location.pathname);
    return () => {
      setCanonical("/");
    };
  }, [noindex, title]);
}
