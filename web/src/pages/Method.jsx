import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import MethodSteps from "../components/MethodSteps.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { waLink } from "../data/site.js";
import "./Inner.css";

const Method = () => {
  usePageMeta("/como-trabajo");

  return (
    <>
      <section className="section pagehead" aria-labelledby="method-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Cómo trabajo"
            title="Un método, no improvisación"
            titleId="method-title"
            as="h1"
            lead="Cuatro pasos que se repiten con cada alumno, porque funcionan: entender el punto de partida, planificar, explicar hasta que cierre y medir el avance."
          />

          <MethodSteps />
        </div>
      </section>

      {/* Las preguntas frecuentes estaban ACÁ y en el Inicio, las mismas seis,
          palabra por palabra. Quedan solo en el Inicio: ahí cierran las dudas
          justo antes del CTA, que es donde hacen falta. Esta página enlaza en
          lugar de repetir, así el JSON-LD de FAQPage tampoco queda declarado dos
          veces para el mismo contenido. */}
      <section className="section section--soft" aria-labelledby="method-dudas">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Antes de reservar"
            title="¿Te quedó alguna duda?"
            titleId="method-dudas"
            lead="Las preguntas que aparecen siempre —precios, cómo son las clases online, qué pasa si falto— están respondidas en el inicio."
          />
          <p className="mt-dudas-acciones">
            <Link className="btn btn--ghost" to="/#home-faq">
              Ver preguntas frecuentes
            </Link>
            <a
              className="btn btn--ghost"
              href={waLink(
                "Hola Agustín, leí cómo trabajás y me quedó una duda.",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" /> Preguntame por WhatsApp
            </a>
          </p>
        </div>
      </section>

      <CtaBlock
        title={
          <>
            Ya sabés cómo trabajo.
            <br />
            <em>Probemos una clase.</em>
          </>
        }
      />
    </>
  );
};

export default Method;
