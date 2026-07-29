import { useEffect, useRef, useState } from "react";
import { BRAND } from "../data/site.js";
import "./Credentials.css";

/* Banda de autoridad, justo después del hero. Los datos que la sostienen ya
   existían pero vivían escondidos en /sobre-mi: acá pasan al frente, en
   tipografía display grande, porque son lo que dice "hay un profesional
   detrás" antes de que el visitante lea una sola línea de venta.

   Todo es información real y verificada. Nada de métricas infladas. */
const ITEMS = [
  {
    count: BRAND.yearsTeaching,
    prefix: "+",
    label: "años dando clases",
    detail: "Acompañando alumnos de primaria a universitario",
  },
  {
    count: 5,
    suffix: "+",
    label: "materias principales",
    detail: "Matemáticas, Física, Fisicoquímica, Química e Inglés",
  },
  {
    text: "5",
    label: "niveles educativos",
    detail: "Primaria, secundaria, técnica, terciario y universitario",
  },
  {
    text: "2",
    label: "modalidades",
    detail: "Online para toda Argentina y presencial en Temperley",
  },
];

const skipAnimation = () =>
  typeof window === "undefined" ||
  typeof IntersectionObserver === "undefined" ||
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

/**
 * Número que cuenta hasta su valor al entrar en pantalla.
 * Estado inicial perezoso: con reduced-motion arranca ya en el valor final, sin
 * llamar a setState dentro del efecto.
 */
const CountUp = ({ target, duration = 1200 }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => (skipAnimation() ? target : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || skipAnimation()) return undefined;

    let raf = 0;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      // Ease-out cúbico: arranca rápido y frena, se lee mejor que lineal.
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          raf = requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    // Red de seguridad: el número nunca puede quedarse en cero.
    const fallback = window.setTimeout(() => setShown(target), 2600);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return <span ref={ref}>{shown}</span>;
};

const Credentials = () => (
  <section className="creds" aria-label="En números">
    <div className="shell">
      <ul className="creds-grid" data-reveal-group="90">
        {ITEMS.map((item) => (
          <li key={item.label} data-reveal="up">
            <p className="creds-num display">
              {item.prefix}
              {item.count ? <CountUp target={item.count} /> : item.text}
              {item.suffix}
            </p>
            <h3 className="creds-label">{item.label}</h3>
            <p className="creds-detail">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default Credentials;
