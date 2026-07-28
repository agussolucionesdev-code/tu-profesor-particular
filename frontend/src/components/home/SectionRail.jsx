import { useEffect, useRef, useState } from "react";
import "./SectionRail.css";

/* Índice lateral de secciones: marca en cuál estás mientras scrolleás y permite
   saltar a cualquiera. Es el complemento natural de la numeración editorial
   (01–07) que ya usa el Inicio.

   Las secciones se descubren del DOM (no hay una lista duplicada que se pueda
   desincronizar): se leen los <section> con id/aria-labelledby conocidos.
   Sólo desktop ancho; en mobile ocuparía lugar sin aportar. */
const RAIL_ITEMS = [
  { id: "hp-hero", index: "01", label: "Inicio" },
  { id: "bss-title", index: "02", label: "Cómo reservás" },
  { id: "hp-about-title", index: "03", label: "Quién es Agustín" },
  { id: "hp-subjects-title", index: "04", label: "Materias" },
  { id: "hp-reasons-title", index: "05", label: "Por qué funciona" },
  { id: "hp-levels-title", index: "06", label: "Niveles" },
  { id: "hp-faq-title", index: "07", label: "Preguntas" },
];

const sectionOf = (id) => {
  if (id === "hp-hero") return document.querySelector(".hp-hero");
  return document.getElementById(id)?.closest("section") ?? null;
};

const SectionRail = () => {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;

    const measure = () => {
      rafRef.current = 0;
      // Activa = la última sección cuyo tope pasó el 35% del viewport.
      const line = window.innerHeight * 0.35;
      let current = 0;
      RAIL_ITEMS.forEach((item, i) => {
        const el = sectionOf(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);
      // El rail aparece recién cuando el hero quedó atrás.
      const hero = document.querySelector(".hp-hero");
      setVisible(hero ? hero.getBoundingClientRect().bottom < line : false);
    };

    const onScroll = () => {
      if (!rafRef.current) rafRef.current = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const goTo = (id) => {
    const el = sectionOf(id);
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav
      className={`hp-srail ${visible ? "is-visible" : ""}`}
      aria-label="Secciones de esta página"
    >
      <ul>
        {RAIL_ITEMS.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              className={`hp-srail-item ${i === active ? "is-active" : ""}`}
              onClick={() => goTo(item.id)}
              aria-current={i === active ? "true" : undefined}
            >
              <span className="hp-srail-index" aria-hidden="true">
                {item.index}
              </span>
              <span className="hp-srail-label">{item.label}</span>
              <span className="hp-srail-tick" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SectionRail;
