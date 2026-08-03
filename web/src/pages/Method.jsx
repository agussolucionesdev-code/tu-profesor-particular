import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import MethodSteps from "../components/MethodSteps.jsx";
import FaqList from "../components/FaqList.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
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

      <section className="section section--soft" aria-labelledby="method-faq">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Antes de reservar"
            title="Preguntas frecuentes"
            titleId="method-faq"
            lead="Lo que casi todos quieren saber antes de la primera clase."
          />

          <FaqList />
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
