import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import usePageMeta from "../hooks/usePageMeta.js";
import "./Inner.css";

const NotFound = () => {
  usePageMeta(
    "Página no encontrada · Tu Profesor Particular",
    "La página que buscabas no existe. Volvé al inicio para ver materias, niveles y reservar tu clase.",
  );

  return (
    <section className="section pagehead nf" aria-labelledby="nf-title">
      <div className="shell">
        <p className="nf-code display display--xl">404</p>
        <h1 id="nf-title" className="display display--lg nf-title">
          Esta página no existe
        </h1>
        <p className="lead nf-lead">
          Puede que el enlace esté viejo o mal escrito. Desde el inicio llegás a
          todo: materias, niveles, cómo trabajo y la reserva de turnos.
        </p>
        <Link className="btn btn--primary" to="/">
          Volver al inicio
          <FaArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

export default NotFound;
