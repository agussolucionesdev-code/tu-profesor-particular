import { useEffect } from "react";

/**
 * Motor de scroll-reveal para el Inicio.
 *
 * El sistema anterior agregaba una clase a la sección ENTERA y la mostraba de
 * golpe con un opacity. Se veía barato. Este hook trabaja a nivel de elemento:
 * cualquier nodo con [data-reveal] arranca oculto (estado definido en CSS según
 * la variante) y recibe [data-revealed] cuando entra al viewport. La transición
 * y la curva de easing viven en reveal-system.css — una sola firma para todo.
 *
 * Stagger real: un contenedor con [data-reveal-group="90"] reparte un
 * transition-delay incremental (90 ms) a sus hijos directos [data-reveal], así
 * las tarjetas entran en cascada ordenada en vez de todas juntas.
 *
 * Accesibilidad: con prefers-reduced-motion o sin IntersectionObserver, todo se
 * marca revelado al instante. Red de seguridad a los 3 s: nada puede quedar
 * invisible si el observer no dispara (pestaña oculta, error, etc.).
 *
 * @param {React.RefObject<HTMLElement>} rootRef  Raíz a observar (la página).
 * @param {Array} deps  Dependencias para re-escanear el DOM.
 */
export default function useScrollReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef?.current;
    if (!root) return undefined;

    const nodes = Array.from(root.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return undefined;

    const reveal = (node) => node.setAttribute("data-revealed", "");

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      nodes.forEach(reveal);
      return undefined;
    }

    // Stagger: reparte transition-delay a los hijos directos de cada grupo.
    root.querySelectorAll("[data-reveal-group]").forEach((group) => {
      const step = Number(group.getAttribute("data-reveal-group")) || 80;
      Array.from(group.children)
        .filter((child) => child.hasAttribute("data-reveal"))
        .forEach((child, index) => {
          child.style.setProperty("--reveal-delay", `${index * step}ms`);
        });
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
    );
    nodes.forEach((node) => io.observe(node));

    const fallback = window.setTimeout(() => nodes.forEach(reveal), 3000);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
