import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import Ilustracion from "../components/Ilustracion.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { META_404 } from "../data/meta.js";
import "./Inner.css";

/* Salidas útiles y no sólo «volver al inicio»: quien llega acá buscaba algo
   concreto, y lo más probable es que sea una de estas cuatro cosas. */
const SALIDAS = [
  { to: "/materias", label: "Materias y niveles" },
  { to: "/como-trabajo", label: "Cómo trabajo" },
  { to: "/sobre-mi", label: "Sobre mí" },
  { to: "/contacto", label: "Contacto" },
];

const NotFound = () => {
  usePageMeta("/404", { meta: META_404 });

  return (
    <section className="section pagehead nf" aria-labelledby="nf-title">
      <div className="shell con-ilus">
        <div>
          <p className="nf-code display display--xl">404</p>
          <h1 id="nf-title" className="display display--lg nf-title">
            Esta página no existe
          </h1>
          <p className="lead nf-lead">
            Puede que el enlace esté viejo o mal escrito. Desde acá llegás a todo:
          </p>
          <ul className="nf-salidas">
            {SALIDAS.map((s) => (
              <li key={s.to}>
                <Link to={s.to}>
                  {s.label}
                  <FaArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <Link className="btn btn--primary" to="/">
            Volver al inicio
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
        <Ilustracion className="con-ilus-imagen nf-ilus" src="/img/pagina-perdida.webp" prioridad />
      </div>
    </section>
  );
};

export default NotFound;
