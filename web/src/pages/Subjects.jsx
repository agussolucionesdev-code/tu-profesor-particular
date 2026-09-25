import { Fragment } from "react";
import { FaArrowUpRightFromSquare, FaWhatsapp } from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import Ilustracion from "../components/Ilustracion.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import usePrecios from "../hooks/usePrecios.js";
import { LEVELS, SUBJECTS, enlaceDeReserva, waLink } from "../data/site.js";
import { formatearPesos } from "../data/precios.js";
import { PORTADA_POR_SLUG, PORTADA_SIZE } from "../data/portadas.js";
import "./Inner.css";

const Subjects = () => {
  usePageMeta("/materias");
  const precios = usePrecios();

  return (
    <>
      <section className="section pagehead" aria-labelledby="subj-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Qué doy"
            title="Materias principales"
            titleId="subj-title"
            as="h1"
            lead="Estas son las que más piden. Doy varias más: si la tuya no está, escribime y lo vemos."
          />

          <ul className="subj-cards" data-reveal-group="80">
            {SUBJECTS.map((s, i) => (
              <li
                key={s.slug}
                className="subj-card"
                style={{ "--subject-color": s.color }}
                data-reveal="up"
              >
                {/* La franja recorta la PARTE DE ARRIBA de la ilustración, donde
                    están los objetos. Cada portada tiene el nombre de la materia
                    escrito en el medio, y la tarjeta ya lo dice en su encabezado:
                    mostrarlo entero pondría "MATEMÁTICA" arriba de "Matemáticas".

                    `alt=""` por lo mismo, en el otro canal: el nombre ya viaja en
                    el encabezado, y una portada con texto alternativo haría que un
                    lector de pantalla diga la materia dos veces seguidas. La
                    imagen no aporta nada que el texto no dé. */}
                <span className="subj-card-media" aria-hidden="true">
                  <img
                    src={PORTADA_POR_SLUG[s.slug]}
                    alt=""
                    width={PORTADA_SIZE.width}
                    height={PORTADA_SIZE.height}
                    /* Sólo la primera entra en pantalla; las otras cuatro caen
                       debajo del pliegue y cargarlas de entrada retrasa lo único
                       que la persona está mirando. */
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </span>
                {/* h2 y no h3: el encabezado de esta sección ES el h1 de la
                    página (SectionHead con as="h1"), así que sus hijos directos
                    son de segundo nivel. Con h3 quedaba un salto h1→h3, que en
                    un lector de pantalla se lee como si faltara contenido. */}
                <h2 className="display display--md subj-card-name">{s.label}</h2>
                <p className="subj-card-claim">
                  <b>{s.tagline}</b> {s.hook}
                </p>
                <p className="subj-card-detail">{s.detail}</p>
                <a
                  className="subj-card-cta"
                  /* `bookingParam` y NO `label`: el kiosco llama a la materia
                     "Matemática" y acá el título dice "Matemáticas". Mandar el
                     plural dejaba la tarjeta sin preseleccionar y —lo caro— la
                     clase cotizada a la tarifa base. Ver `site.js`. */
                  href={enlaceDeReserva("materia", { materia: s.bookingParam })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Reservar {s.label}
                  <FaArrowUpRightFromSquare aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>

          <div className="subj-extra" data-reveal="up">
            {/* h2 por el mismo motivo que las tarjetas: sigue colgando del h1.
                Los niveles de la sección 02, en cambio, sí van en h3, porque esa
                sección tiene su propio h2. */}
            <h2>Doy muchas más materias</h2>
            <p>
              Análisis Matemático, Álgebra, Biología, Historia y otras según el
              plan de estudios. Si la tuya no aparece, contame qué necesitás y
              te digo de entrada si puedo ayudarte.
            </p>
            <a
              className="btn btn--primary"
              href={waLink(
                "Hola Agustín, necesito ayuda con una materia que no veo en tu sitio. ¿Me podés ayudar?",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Consultar por mi materia
            </a>
          </div>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="subj-levels">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Sin importar dónde estés"
            title="Todos los niveles"
            titleId="subj-levels"
            lead='No hay nivel "demasiado básico" ni "demasiado avanzado". Se arranca desde tu punto real.'
          />
          <ul className="plain-grid" data-reveal-group="70">
            {LEVELS.map((l) => (
              <li key={l.label} data-reveal="up">
                <Ilustracion className="plain-ilus plain-ilus--nivel" src={l.ilustracion} lado={240} />
                <h3>{l.label}</h3>
                <p>{l.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 03 · PRECIOS ──────────────────────────────────────────────────────
          Después de materias y niveles, porque el precio depende de los dos: la
          persona llega a esta tabla sabiendo ya en qué fila está.

          Los números no están escritos acá: vienen en vivo del sistema de turnos
          (ver data/precios.js). Mientras cargan, o si el servidor no responde,
          la tabla no se muestra y el texto manda al kiosco, que calcula el mismo
          precio. Nunca un número inventado. */}
      <section className="section" aria-labelledby="subj-precios" id="precios">
        <div className="shell">
          <SectionHead
            index="03"
            kicker="Precios"
            title="Cuánto sale una clase"
            titleId="subj-precios"
            lead="Por hora, según el nivel. Mismo precio online y presencial, y sin recargo por urgencia ni por fin de semana."
          />

          <div className="precios" data-reveal="up" aria-live="polite" aria-busy={precios.fase === "cargando"}>
            {precios.fase === "listo" ? (
              <>
                <table className="precios-tabla">
                  <caption className="sr-only">
                    Precio de una clase por nivel, de una hora y de dos horas
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Nivel</th>
                      <th scope="col">1 hora</th>
                      <th scope="col">
                        2 horas
                        {precios.descuento && (
                          <span className="precios-nota-col">
                            {precios.descuento.porcentaje}% menos por hora
                          </span>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {precios.filas.map((f) => (
                      <Fragment key={f.nivel}>
                        <tr>
                          <th scope="row">
                            {f.etiqueta}
                            {/* Con una fila de ciencias debajo, esta sola parecería
                                aplicar a todo el nivel: se aclara a qué aplica. */}
                            <span className="precios-detalle">
                              {f.ciencias ? `${f.detalle} · resto de las materias` : f.detalle}
                            </span>
                          </th>
                          <td>{formatearPesos(f.hora)}</td>
                          <td>{formatearPesos(f.dosHoras)}</td>
                        </tr>
                        {/* Las ciencias van como una fila propia debajo de su nivel,
                            y no como nota al pie: es la diferencia de precio que más
                            gente va a buscar, y en una nota nadie la encuentra. */}
                        {f.ciencias && (
                          <tr className="precios-fila-ciencias">
                            {/* Título corto y la lista abajo, chica: con la lista
                                entera como título, en un teléfono la celda se partía
                                en cinco renglones. El nivel se dice para el lector de
                                pantalla, que recorre la tabla fila por fila. */}
                            <th scope="row">
                              <span className="sr-only">{f.etiqueta}, </span>
                              Matemática y ciencias
                              <span className="precios-detalle">
                                {listarMaterias(f.ciencias.materias)}
                              </span>
                            </th>
                            <td>{formatearPesos(f.ciencias.hora)}</td>
                            <td>{formatearPesos(f.ciencias.dosHoras)}</td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <p className="precios-pie">
                  No se paga nada por adelantado. El precio exacto de tu clase lo
                  ves al reservar, antes de dejar tus datos.
                </p>
              </>
            ) : (
              <p className="precios-respaldo">
                {precios.fase === "cargando"
                  ? "Cargando los precios…"
                  : "El precio de tu clase lo ves al reservar, antes de dejar tus datos."}{" "}
                <a href={enlaceDeReserva("materias-otras")} target="_blank" rel="noopener noreferrer">
                  Ver precio y horarios
                </a>
              </p>
            )}
          </div>
        </div>
      </section>

      <CtaBlock />
    </>
  );
};

/* «Matemática, Física, Química y Fisicoquímica»: con «y» antes de la última. */
const listarMaterias = (materias) =>
  materias.length < 2
    ? materias.join("")
    : `${materias.slice(0, -1).join(", ")} y ${materias[materias.length - 1]}`;

export default Subjects;
