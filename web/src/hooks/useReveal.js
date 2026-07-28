import { useEffect } from "react";

/**
 * Revela los elementos [data-reveal] al entrar en pantalla, con stagger por
 * grupo ([data-reveal-group="80"] reparte delay a sus hijos directos).
 * Con reduced-motion o sin IntersectionObserver, todo se muestra al instante.
 * Red de seguridad a 3 s: nada puede quedar invisible.
 *
 * Se ejecuta en cada cambio de ruta (dep: key) porque el DOM cambia.
 */
export default function useReveal(key) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return undefined;

    const reveal = (node) => node.setAttribute("data-revealed", "");

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      nodes.forEach(reveal);
      return undefined;
    }

    document.querySelectorAll("[data-reveal-group]").forEach((group) => {
      const step = Number(group.getAttribute("data-reveal-group")) || 80;
      Array.from(group.children)
        .filter((child) => child.hasAttribute("data-reveal"))
        .forEach((child, i) => {
          child.style.setProperty("--reveal-delay", `${i * step}ms`);
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
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));

    const fallback = window.setTimeout(() => nodes.forEach(reveal), 3000);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [key]);
}
