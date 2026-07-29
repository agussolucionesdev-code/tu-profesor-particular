import { FaArrowUpRightFromSquare, FaWhatsapp } from "react-icons/fa6";
import { BOOKING_RESERVE_URL, waLink } from "../data/site.js";
import monogram from "../assets/monogram.png";
import "./CtaBlock.css";

/* Cierre de página. Se repite al final de cada sección del sitio para que el
   camino a reservar esté siempre a un clic. */
const CtaBlock = ({
  title = (
    <>
      El parcial no espera.
      <br />
      <em>Empezá hoy.</em>
    </>
  ),
  lead = "La primera clase es de diagnóstico: entendemos dónde estás y qué necesitás. Sin pagos por adelantado y sin compromiso.",
}) => (
  <section className="section section--dark cta" aria-labelledby="cta-title">
    <span className="grid-texture" aria-hidden="true" />
    <img src={monogram} alt="" className="cta-watermark" aria-hidden="true" />

    <div className="shell cta-inner">
      <h2 id="cta-title" className="display display--xl" data-reveal="clip">
        {title}
      </h2>
      <p className="lead cta-lead" data-reveal="up">
        {lead}
      </p>
      <div className="cta-actions" data-reveal="up">
        <a
          className="btn btn--primary"
          href={BOOKING_RESERVE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Reservar mi clase
          <FaArrowUpRightFromSquare aria-hidden="true" />
        </a>
        <a
          className="btn btn--ghost"
          href={waLink(
            "Hola Agustín, vengo desde tu sitio web y quiero consultarte antes de reservar.",
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp aria-hidden="true" />
          Consultar primero
        </a>
      </div>
    </div>
  </section>
);

export default CtaBlock;
