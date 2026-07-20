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

const BookingStepsShowcase = () => (
  <section className="bss" aria-labelledby="bss-title">
    <div className="bss-inner">
      <SectionHead
        index="02"
        kicker="Reservar es de verdad así de simple"
        title="Cómo sacás tu turno, paso a paso"
        titleId="bss-title"
        lead="Mirá exactamente cómo se ve. Cinco pasos, la mayoría de un solo toque, sin registro ni pagos por adelantado."
      />

      <ol className="bss-steps">
        {STEPS.map((step) => (
          <li key={step.n} className="bss-step">
            <StepFrame callout={step.callout}>{step.render()}</StepFrame>
            <div className="bss-caption">
              <span className="bss-badge">{String(step.n).padStart(2, "0")}</span>
              <h3 className="bss-step-title">{step.title}</h3>
              <p className="bss-step-desc">{step.desc}</p>
              <ul className="bss-step-notes">
                {step.notes.map((note) => (
                  <li key={note}>
                    <FaCheckCircle aria-hidden="true" /> {note}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

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

export default BookingStepsShowcase;
