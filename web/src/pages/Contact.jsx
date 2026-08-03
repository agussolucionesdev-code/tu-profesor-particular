import { useEffect, useRef, useState } from "react";
import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaCheck,
  FaCopy,
  FaEnvelope,
  FaLocationDot,
  FaWhatsapp,
} from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BOOKING_RESERVE_URL, CONTACT, waLink } from "../data/site.js";
import "./Inner.css";
import "./Contact.css";

/* Motivos de consulta. Cada uno abre WhatsApp con el mensaje ya redactado: el
   visitante no tiene que pensar cómo arrancar la conversación, que es la
   fricción real de una página de contacto. Los textos hablan sólo de lo que el
   servicio hace de verdad. */
const INTENTS = [
  {
    id: "materia",
    label: "Tengo una materia difícil",
    message:
      "Hola Agustín, vengo desde tu sitio web. Estoy con dificultades en una materia y quería contarte mi situación para ver si podés ayudarme.",
  },
  {
    id: "otra",
    label: "¿Das mi materia?",
    message:
      "Hola Agustín, vengo desde tu sitio web. Quería consultarte si das una materia que no vi en la lista.",
  },
  {
    id: "presencial",
    label: "Quiero clases presenciales",
    message:
      "Hola Agustín, vengo desde tu sitio web. Me interesan las clases presenciales en Temperley y quería consultarte cómo coordinarlas.",
  },
  {
    id: "fecha",
    label: "Tengo un examen cerca",
    message:
      "Hola Agustín, vengo desde tu sitio web. Tengo una fecha de examen cerca y necesito preparar el tema con tiempo. ¿Podemos ver cómo organizarlo?",
  },
  {
    id: "antes",
    label: "Dudas antes de reservar",
    message:
      "Hola Agustín, vengo desde tu sitio web. Antes de reservar una clase quería hacerte unas preguntas.",
  },
];

/* Los pasos que el visitante va a encontrar del otro lado del botón: reservar
   deja de ser un salto al vacío. */
const BOOKING_STEPS = [
  "Elegís materia y modalidad",
  "Elegís día y horario",
  "Dejás tus datos y listo",
];

/** Botón de copiar, con la confirmación anunciada para lectores de pantalla. */
const CopyButton = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el dato sigue visible y seleccionable.
    }
  };

  return (
    <button
      type="button"
      className={`ct-copy ${copied ? "is-done" : ""}`}
      onClick={copy}
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
    >
      {copied ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
      <span aria-hidden="true">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
};

const Contact = () => {
  usePageMeta("/contacto");

  // El motivo elegido define con qué mensaje se abre WhatsApp.
  const [intent, setIntent] = useState(INTENTS[0]);

  return (
    <section className="section pagehead ct" aria-labelledby="contact-title">
      <div className="shell">
        <SectionHead
          index="01"
          kicker="Hablemos"
          title="Contacto"
          titleId="contact-title"
            as="h1"
          lead="Dos caminos: reservás directo, o me escribís y lo charlamos antes. Los dos terminan en el mismo lugar."
        />

        <div className="ct-layout">
          {/* ── Camino 1: reservar (la acción principal) ── */}
          <article className="ct-primary" data-reveal="up">
            <p className="ct-eyebrow">
              <span className="ct-dot" aria-hidden="true" />
              El camino más rápido
            </p>

            <h3 className="display display--lg ct-primary-title">
              Reservá sin
              <br />
              <em>escribirle a nadie</em>
            </h3>

            <p className="ct-primary-lead">
              El sistema de turnos hace todo solo. No hace falta que me
              consultes disponibilidad ni que esperes una respuesta.
            </p>

            <ol className="ct-steps">
              {BOOKING_STEPS.map((step, i) => (
                <li key={step}>
                  <span className="ct-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <a
              className="ct-primary-cta"
              href={BOOKING_RESERVE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Reservar mi clase
              <FaArrowUpRightFromSquare aria-hidden="true" />
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>

            <ul className="ct-seals">
              <li>
                <FaCheck aria-hidden="true" /> Menos de un minuto
              </li>
              <li>
                <FaCheck aria-hidden="true" /> Sin registro
              </li>
              <li>
                <FaCheck aria-hidden="true" /> Sin pagar por adelantado
              </li>
            </ul>
          </article>

          {/* ── Camino 2: escribir, con el mensaje ya armado ── */}
          <div className="ct-channels">
            <article className="ct-card ct-card--wa" data-reveal="up">
              <header className="ct-card-head">
                <span className="ct-icon ct-icon--wa" aria-hidden="true">
                  <FaWhatsapp />
                </span>
                <div>
                  <h3 className="ct-card-title">WhatsApp</h3>
                  <p className="ct-card-sub">{CONTACT.whatsappDisplay}</p>
                </div>
              </header>

              <p className="ct-card-copy">
                Elegí de qué se trata y te abro el chat con el mensaje ya
                escrito. Si querés, lo editás antes de enviarlo.
              </p>

              <fieldset className="ct-intents">
                <legend className="sr-only">Motivo de tu consulta</legend>
                {INTENTS.map((item) => (
                  <label
                    key={item.id}
                    className={`ct-chip ${intent.id === item.id ? "is-on" : ""}`}
                  >
                    <input
                      type="radio"
                      name="contact-intent"
                      value={item.id}
                      checked={intent.id === item.id}
                      onChange={() => setIntent(item)}
                    />
                    {item.label}
                  </label>
                ))}
              </fieldset>

              {/* Vista previa: se ve exactamente qué se va a enviar. */}
              <p className="ct-preview">
                <span className="ct-preview-tag">Se enviará</span>
                {intent.message}
              </p>

              <a
                className="ct-wa-cta"
                href={waLink(intent.message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Abrir WhatsApp
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </article>

            <article className="ct-card" data-reveal="up">
              <header className="ct-card-head">
                <span className="ct-icon" aria-hidden="true">
                  <FaEnvelope />
                </span>
                <div>
                  <h3 className="ct-card-title">Email</h3>
                  <p className="ct-card-sub ct-mono">{CONTACT.email}</p>
                </div>
              </header>
              <div className="ct-card-actions">
                <a className="ct-link" href={`mailto:${CONTACT.email}`}>
                  Escribir un email
                  <FaArrowRight aria-hidden="true" />
                </a>
                <CopyButton value={CONTACT.email} label="el email" />
              </div>
            </article>

            <article className="ct-card" data-reveal="up">
              <header className="ct-card-head">
                <span className="ct-icon" aria-hidden="true">
                  <FaLocationDot />
                </span>
                <div>
                  <h3 className="ct-card-title">Clases presenciales</h3>
                  <p className="ct-card-sub">
                    {CONTACT.addressLine}
                    <br />
                    {CONTACT.region}
                  </p>
                </div>
              </header>
              <div className="ct-card-actions">
                <a
                  className="ct-link"
                  href={CONTACT.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver en el mapa
                  <FaArrowUpRightFromSquare aria-hidden="true" />
                </a>
                <CopyButton
                  value={`${CONTACT.addressLine}, ${CONTACT.region}`}
                  label="la dirección"
                />
              </div>
              <p className="ct-note">
                Si estás lejos, las clases online funcionan igual: se dan por
                videollamada para toda Argentina.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
