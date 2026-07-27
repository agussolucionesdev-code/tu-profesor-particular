import { FaPlus } from "react-icons/fa";
import SectionHead from "./SectionHead";
import "./FaqSection.css";

/* Preguntas frecuentes. Contenido 100% real, derivado de cómo funciona el
   servicio (nada inventado): modalidad, sin adelanto, cómo se reserva, gestión
   con enlace seguro, materias/niveles, primera clase de diagnóstico.
   Acordeón nativo <details>/<summary>: accesible por teclado sin JS. */
const FAQS = [
  {
    q: "¿Cómo reservo una clase?",
    a: "Elegís la materia, la modalidad y el turno en menos de un minuto, sin registro ni contraseña. Al confirmar recibís un código y un enlace seguro para gestionar tu turno.",
  },
  {
    q: "¿Las clases son online o presenciales?",
    a: "Las dos. Online por videollamada, o presencial en Temperley, Buenos Aires. Elegís la que te quede cómoda en el momento de reservar.",
  },
  {
    q: "¿Qué materias y niveles das?",
    a: "Matemáticas, Física, Fisicoquímica, Química e Inglés como principales — y muchas otras a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  },
  {
    q: "¿Tengo que pagar por adelantado?",
    a: "No. Sin adelanto y sin compromiso. La primera clase es de diagnóstico: si no sentís que avanzaste, no volvés.",
  },
  {
    q: "¿Puedo reprogramar o cancelar?",
    a: "Sí, cuando quieras, desde tu enlace seguro de gestión. Sin llamadas ni trámites: reprogramás o cancelás en un par de toques.",
  },
  {
    q: "¿Cómo es la primera clase?",
    a: "Es de diagnóstico: entendemos desde dónde partís y qué necesitás, y armamos un plan concreto para las próximas clases.",
  },
];

const FaqSection = () => (
  <section className="hp-section hp-section--soft" aria-labelledby="hp-faq-title">
    <div className="hp-section-inner">
      <SectionHead
        index="07"
        kicker="Antes de reservar"
        title="Preguntas frecuentes"
        titleId="hp-faq-title"
        lead="Lo que casi todos quieren saber antes de la primera clase. Si te queda una duda, escribime y la resolvemos."
      />

      <ul className="hp-faq-list" data-reveal-group="70">
        {FAQS.map((item) => (
          <li key={item.q} className="hp-faq-item" data-reveal="up">
            <details className="hp-faq-details">
              <summary className="hp-faq-q">
                <span>{item.q}</span>
                <span className="hp-faq-icon" aria-hidden="true">
                  <FaPlus />
                </span>
              </summary>
              <p className="hp-faq-a">{item.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FaqSection;
