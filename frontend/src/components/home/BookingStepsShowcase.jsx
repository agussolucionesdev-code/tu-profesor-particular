import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaCalendarCheck,
  FaCheckCircle,
  FaLaptop,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { getSubjectIcon } from "../../constants/subjectIcons";
import SectionHead from "./SectionHead";
import "./BookingStepsShowcase.css";

// Recreaciones fieles de cada paso del kiosco: mismos íconos y colores reales,
// renderizadas en vivo (no capturas), así siempre reflejan la UII actual.

const DEMO_SUBJECTS = [
  "Matemática",
  "Física",
  "Química",
  "Biología",
  "Historia",
  "Inglés",
];

const StepFrame = ({ children, callout }) => (
  <div className="bss-frame" aria-hidden="true">
    <div className="bss-frame-bar">
      <span className="bss-dot" />
      <span className="bss-dot" />
      <span className="bss-dot" />
      <span className="bss-frame-url">turnos.tuprofesorparticular.com.ar/reservar</span>
    </div>
    <div className="bss-frame-body">{children}</div>
    {callout && <span className="bss-callout">{callout}</span>}
  </div>
);

const MiniStepper = ({ active }) => (
  <div className="bss-mini-stepper">
    {["Materia", "Modalidad", "Turno", "Datos", "Confirmar"].map((label, i) => {
      const n = i + 1;
      const state = n < active ? "done" : n === active ? "current" : "todo";
      return (
        <span key={label} className={`bss-mini-step is-${state}`}>
          <span className="bss-mini-dot">{n < active ? <FaCheckCircle /> : n}</span>
        </span>
      );
    })}
  </div>
);

const STEPS = [
  {
    n: 1,
    title: "Elegí qué necesitás",
    desc: "Primero tu nivel y después la materia, en tarjetas grandes con su ícono. Nada de formularios: reconocés y tocás.",
    notes: ["Sin registro ni contraseña", "Todas las materias con su ícono"],
    callout: "Tarjetas grandes: reconocés al toque",
    render: () => (
      <div className="bss-demo">
        <MiniStepper active={1} />
        <p className="bss-demo-title">¿Qué materia?</p>
        <div className="bss-subject-grid">
          {DEMO_SUBJECTS.map((s, idx) => {
            const Icon = getSubjectIcon(s);
            return (
              <span key={s} className={`bss-chip ${idx === 0 ? "is-selected" : ""}`}>
                <Icon aria-hidden="true" />
                {s}
              </span>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    n: 2,
    title: "Online o presencial",
    desc: "Elegís cómo querés la clase. Si es presencial, te mostramos la dirección; si es online, te llega el enlace por email.",
    notes: ["Videollamada o en Temperley", "Vos elegís según te quede cómodo"],
    callout: "Dos opciones claras, un toque",
    render: () => (
      <div className="bss-demo">
        <MiniStepper active={2} />
        <p className="bss-demo-title">¿Cómo preferís la clase?</p>
        <div className="bss-modality-grid">
          <span className="bss-modality is-selected">
            <FaLaptop aria-hidden="true" />
            <strong>Online</strong>
            <small>Videollamada</small>
          </span>
          <span className="bss-modality">
            <FaMapMarkerAlt aria-hidden="true" />
            <strong>Presencial</strong>
            <small>Temperley, Bs. As.</small>
          </span>
        </div>
      </div>
    ),
  },
  {
    n: 3,
    title: "El turno, a un toque",
    desc: "Elegís la duración y aparecen los próximos horarios libres agrupados por día. Sin pelear con un calendario.",
    notes: ["Solo turnos realmente disponibles", "Hoy, mañana y las próximas fechas"],
    callout: "Horarios reales, en 1 clic",
    render: () => (
      <div className="bss-demo">
        <MiniStepper active={3} />
        <p className="bss-demo-label">Duración</p>
        <div className="bss-pills">
          <span className="bss-pill">30 min</span>
          <span className="bss-pill is-selected">1 hora</span>
          <span className="bss-pill">1 h 30</span>
        </div>
        <p className="bss-demo-label">Mañana</p>
        <div className="bss-slots">
          {["09:00", "09:30", "10:00", "10:30", "11:00"].map((t, i) => (
            <span key={t} className={`bss-slot ${i === 2 ? "is-selected" : ""}`}>{t}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    n: 4,
    title: "Tus datos, solo al final",
    desc: "Recién acá pedimos lo justo para confirmar y avisarte. Nombre, teléfono y —si querés— email. Nada de más.",
    notes: ["Solo lo esencial", "El email es opcional"],
    callout: "Los datos, últimos: cero fricción",
    render: () => (
      <div className="bss-demo">
        <MiniStepper active={4} />
        <p className="bss-demo-title">Tus datos</p>
        <div className="bss-form">
          <span className="bss-input">Juan Pérez</span>
          <span className="bss-input">+54 9 11 2222 3333</span>
          <span className="bss-input bss-input--muted">Email (opcional)</span>
        </div>
      </div>
    ),
  },
  {
    n: 5,
    title: "Confirmá y listo",
    desc: "Revisás un resumen tipo ticket y confirmás. Recibís un código y un enlace seguro para reprogramar o cancelar cuando quieras.",
    notes: ["Código + enlace seguro de gestión", "Sin pagos por adelantado"],
    callout: "Resumen claro antes de confirmar",
    render: () => (
      <div className="bss-demo">
        <MiniStepper active={5} />
        <p className="bss-demo-title">Revisá y confirmá</p>
        <div className="bss-summary">
          <div><span>Materia</span><strong>Matemática</strong></div>
          <div><span>Modalidad</span><strong>Online</strong></div>
          <div><span>Fecha</span><strong>Mañana, 10:00</strong></div>
        </div>
        <span className="bss-confirm">Confirmar reserva</span>
      </div>
    ),
  },
];

const StepNotes = ({ notes }) => (
  <ul className="bss-step-notes">
    {notes.map((note) => (
      <li key={note}>
        <FaCheckCircle aria-hidden="true" /> {note}
      </li>
    ))}
  </ul>
);

/* Fallback apilado: mobile y reduced-motion. Los cinco pasos, uno debajo del
   otro, con reveal al entrar. Es el layout probado. */
const StackedSteps = () => (
  <ol className="bss-steps">
    {STEPS.map((step) => (
      <li key={step.n} className="bss-step" data-reveal="scale">
        <StepFrame callout={step.callout}>{step.render()}</StepFrame>
        <div className="bss-caption">
          <span className="bss-badge">{String(step.n).padStart(2, "0")}</span>
          <h3 className="bss-step-title">{step.title}</h3>
          <p className="bss-step-desc">{step.desc}</p>
          <StepNotes notes={step.notes} />
        </div>
      </li>
    ))}
  </ol>
);

/* Modo inmersivo (scrollytelling): el stage se fija en pantalla y el mockup
   avanza por los 5 pasos según el progreso de scroll. Solo desktop sin
   reduced-motion — abajo cae al apilado. El paso activo sale de la posición del
   contenedor alto respecto al viewport (rAF-throttled), no de timers. */
const SEGMENT_VH = 58; // scroll por paso, además del primer viewport

const ImmersiveSteps = () => {
  const scrollRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const passed = Math.min(Math.max(-rect.top, 0), total);
      const idx = Math.min(
        STEPS.length - 1,
        Math.floor((passed / total) * STEPS.length),
      );
      setActive((prev) => (prev === idx ? prev : idx));
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const step = STEPS[active];

  return (
    <div
      className="bss-scroll"
      ref={scrollRef}
      style={{ height: `calc(100vh + ${(STEPS.length - 1) * SEGMENT_VH}vh)` }}
    >
      <div className="bss-sticky">
        <div className="bss-stage-visual" key={`v-${active}`}>
          <StepFrame callout={step.callout}>{step.render()}</StepFrame>
        </div>

        <div className="bss-stage-caption">
          <span className="bss-badge" key={`n-${active}`}>
            {String(step.n).padStart(2, "0")}
          </span>
          <h3 className="bss-step-title" key={`t-${active}`}>
            {step.title}
          </h3>
          <p className="bss-step-desc" key={`d-${active}`}>
            {step.desc}
          </p>
          <div key={`no-${active}`}>
            <StepNotes notes={step.notes} />
          </div>

          {/* Rail de progreso: cinco marcas, la activa llena */}
          <div className="bss-rail" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.n}
                className={`bss-rail-tick ${i === active ? "is-active" : ""} ${i < active ? "is-done" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BookingStepsShowcase = () => {
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 900px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () => setImmersive(wide.matches && !reduce.matches);
    compute();
    wide.addEventListener("change", compute);
    reduce.addEventListener("change", compute);
    return () => {
      wide.removeEventListener("change", compute);
      reduce.removeEventListener("change", compute);
    };
  }, []);

  return (
    <section className="bss" aria-labelledby="bss-title">
      <div className="bss-inner">
        <SectionHead
          index="02"
          kicker="Reservar es de verdad así de simple"
          title="Cómo sacás tu turno, paso a paso"
          titleId="bss-title"
          lead="Mirá exactamente cómo se ve. Cinco pasos, la mayoría de un solo toque, sin registro ni pagos por adelantado."
        />
      </div>

      {immersive ? <ImmersiveSteps /> : (
        <div className="bss-inner">
          <StackedSteps />
        </div>
      )}

      <div className="bss-inner">
        <div className="bss-cta">
          <Link to="/reservar" className="bss-cta-btn">
            <FaCalendarCheck aria-hidden="true" />
            Probalo ahora — sacá tu turno
            <FaArrowRight aria-hidden="true" />
          </Link>
          <p className="bss-cta-note">Te lleva menos de un minuto. Sin tarjeta, sin compromiso.</p>
        </div>
      </div>
    </section>
  );
};

export default BookingStepsShowcase;
