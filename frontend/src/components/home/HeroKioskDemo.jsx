import { useEffect, useRef, useState } from "react";
import {
  FaCheckCircle,
  FaLaptop,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { getSubjectIcon } from "../../constants/subjectIcons";
import "./HeroKioskDemo.css";

// Demo de la app que "se reserva sola": cicla por los 5 pasos del kiosco con
// transiciones, mostrando el proceso de reserva en vivo. Respeta
// prefers-reduced-motion (se congela en el paso 1) y pausa si la pestaña se
// oculta o el usuario pasa el mouse por encima.

const STEP_LABELS = ["Materia", "Modalidad", "Turno", "Datos", "Confirmar"];

const Stepper = ({ step }) => (
  <div className="hkd-stepper">
    {STEP_LABELS.map((label, i) => {
      const n = i + 1;
      const state = n < step ? "done" : n === step ? "current" : "todo";
      return (
        <span key={label} className={`hkd-step is-${state}`}>
          {n < step ? <FaCheckCircle /> : n}
        </span>
      );
    })}
  </div>
);

const StepMateria = () => (
  <>
    <p className="hkd-title">¿Qué materia?</p>
    <div className="hkd-grid">
      {["Matemática", "Física", "Química", "Inglés"].map((s, i) => {
        const Icon = getSubjectIcon(s);
        return (
          <span key={s} className={`hkd-cell ${i === 0 ? "is-sel" : ""}`}>
            <Icon aria-hidden="true" />
            {s}
          </span>
        );
      })}
    </div>
  </>
);

const StepModalidad = () => (
  <>
    <p className="hkd-title">¿Cómo la preferís?</p>
    <div className="hkd-grid hkd-grid--2">
      <span className="hkd-modal is-sel">
        <FaLaptop aria-hidden="true" />
        <strong>Online</strong>
        <small>Videollamada</small>
      </span>
      <span className="hkd-modal">
        <FaMapMarkerAlt aria-hidden="true" />
        <strong>Presencial</strong>
        <small>Temperley</small>
      </span>
    </div>
  </>
);

const StepTurno = () => (
  <>
    <p className="hkd-title">Elegí tu turno</p>
    <div className="hkd-pills">
      <span className="hkd-pill">30m</span>
      <span className="hkd-pill is-sel">1 hora</span>
      <span className="hkd-pill">1h 30</span>
    </div>
    <p className="hkd-label">Mañana</p>
    <div className="hkd-slots">
      {["09:00", "09:30", "10:00", "10:30"].map((t, i) => (
        <span key={t} className={`hkd-slot ${i === 2 ? "is-sel" : ""}`}>{t}</span>
      ))}
    </div>
  </>
);

const StepDatos = () => (
  <>
    <p className="hkd-title">Tus datos</p>
    <div className="hkd-form">
      <span className="hkd-input hkd-typed">Juan Pérez</span>
      <span className="hkd-input hkd-typed hkd-d1">+54 9 11 2222 3333</span>
      <span className="hkd-input hkd-muted">Email (opcional)</span>
    </div>
  </>
);

const StepConfirmar = () => (
  <>
    <p className="hkd-title">Revisá y confirmá</p>
    <div className="hkd-summary">
      <div><span>Materia</span><strong>Matemática</strong></div>
      <div><span>Modalidad</span><strong>Online</strong></div>
      <div><span>Turno</span><strong>Mañana 10:00</strong></div>
    </div>
    <span className="hkd-confirm">
      <FaCheckCircle aria-hidden="true" /> Confirmar reserva
    </span>
  </>
);

const STEPS = [StepMateria, StepModalidad, StepTurno, StepDatos, StepConfirmar];
const INTERVAL = 2400;

const HeroKioskDemo = () => {
  const [step, setStep] = useState(1);
  const pausedRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return undefined;

    const id = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      setStep((s) => (s >= 5 ? 1 : s + 1));
    }, INTERVAL);

    return () => window.clearInterval(id);
  }, []);

  const Current = STEPS[step - 1];

  return (
    <div
      className="hkd"
      aria-hidden="true"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="hkd-bar">
        <span className="hkd-dot" />
        <span className="hkd-dot" />
        <span className="hkd-dot" />
        <span className="hkd-url">turnos.tuprofesorparticular.com.ar</span>
      </div>
      <div className="hkd-body">
        <Stepper step={step} />
        <div className="hkd-stage" key={step}>
          <Current />
        </div>
      </div>
      <div className="hkd-progress" aria-hidden="true">
        <span className="hkd-progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
      </div>
    </div>
  );
};

export default HeroKioskDemo;
