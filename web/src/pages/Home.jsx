import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaCheck,
  FaWhatsapp,
} from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import Typewriter from "../components/Typewriter.jsx";
import MathBackdrop from "../components/MathBackdrop.jsx";
import Credentials from "../components/Credentials.jsx";
import PullQuote from "../components/PullQuote.jsx";
import MethodSteps from "../components/MethodSteps.jsx";
import FaqList from "../components/FaqList.jsx";
import Ilustracion from "../components/Ilustracion.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import {
  BRAND,
  CONTACT,
  LEVELS,
  REASONS,
  SUBJECTS,
  enlaceDeReserva,
  waLink,
} from "../data/site.js";
import { LA_AUTONOMIA, LO_QUE_SE_ESCUCHAN } from "../data/voz.js";
import { PRUEBA, TESTIMONIOS, hayTestimonios } from "../data/prueba.js";
import "./Home.css";

const Home = () => {
  usePageMeta("/");

  return (
    <>
      {/* ── Hero ── */}
      <section className="section--dark hero" aria-label="Presentación">
        <MathBackdrop />
        <span className="hero-slab" aria-hidden="true" />

        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow" data-entrada="up" style={{ "--i": 0 }}>
              <span className="hero-dot" aria-hidden="true" />
              Online y presencial
              <span className="hero-sep" aria-hidden="true" />
              {CONTACT.addressLine}
            </p>

            {/* La frase que el visitante ya pensó, escribiéndose sola: primero
                que se reconozca, después la promesa. */}
            <p className="hero-pain" data-entrada="up" style={{ "--i": 1 }}>
              <span className="hero-pain-quote" aria-hidden="true">
                «
              </span>
              No entiendo nada de{" "}
              <Typewriter
                className="hero-pain-word"
                words={[
                  "Matemáticas",
                  "Física",
                  "Química",
                  "Análisis Matemático",
                  "Fisicoquímica",
                ]}
              />
              <span className="hero-pain-quote" aria-hidden="true">
                »
              </span>
            </p>

            {/* Sin <br>: el titular anterior era corto y el salto lo partía en
                dos líneas prolijas, pero esta pregunta mide 41 caracteres y el
                salto forzado dejaba «pero» solo en una línea en cuanto el ancho
                no alcanzaba. Fluye y el navegador corta donde entra. */}
            <h1 className="display display--xl hero-title" data-entrada="titular">
              ¿Tu hijo estudia, pero <em>sigue sin entender?</em>
            </h1>

            <p className="hero-tagline" data-entrada="up" style={{ "--i": 2 }}>
              <span>Juntos,</span> despejando el camino a{" "}
              <em>la meta.</em>
            </p>

            {/* LE HABLA A LA FAMILIA. En primaria y secundaria quien reserva y
                paga suele ser un adulto, y la portada le hablaba sólo al
                estudiante. Decisión de Agustín, con la recomendación de ChatGPT
                (GPT-6 Astra) de por medio. La bajada dice qué hace él, no qué le
                pasa al chico: el titular ya nombró el problema. */}
            <p className="lead hero-lead" data-entrada="up" style={{ "--i": 2 }}>
              Soy {BRAND.person}. Hace más de {BRAND.yearsTeaching} años doy clases
              particulares. Reviso qué le está costando y preparo la clase para
              trabajar sobre eso, con explicaciones y práctica.
            </p>

            <div className="hero-actions" data-entrada="up" style={{ "--i": 3 }}>
              <a
                className="btn btn--primary"
                href={enlaceDeReserva("portada")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Reservar una clase
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
              {/* La secundaria es WhatsApp y no «Ver cómo trabajo»: una familia
                  que duda quiere preguntar antes de reservar, no leer más. «Cómo
                  trabajo» sigue en el menú y más abajo en la portada. */}
              <a
                className="btn btn--ghost"
                href={waLink("Hola Agustín, quiero consultar antes de reservar una clase.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Consultar por WhatsApp
              </a>
            </div>

            {/* El otro público —estudiantes de secundaria, adultos en CENS,
                terciario y facultad— entra por acá, sin carrusel que alterne
                los dos mensajes: un titular que cambia solo no lo lee nadie
                completo. */}
            <Link className="hero-otro-publico" to="/materias" data-entrada="up" style={{ "--i": 4 }}>
              ¿Son para vos? Materias y niveles
              <FaArrowRight aria-hidden="true" />
            </Link>

            <ul className="hero-trust" data-entrada="up" style={{ "--i": 5 }}>
              <li>
                <FaCheck aria-hidden="true" /> Sin pagos por adelantado
              </li>
              <li>
                <FaCheck aria-hidden="true" /> La primera clase parte de lo que cuesta
              </li>
              <li>
                <FaCheck aria-hidden="true" /> Ves el precio antes de dejar tus datos
              </li>
            </ul>
          </div>

          <figure className="hero-photo" data-entrada="up" style={{ "--i": 2 }}>
            {/* La foto del hero es el elemento más grande de la portada, así
                que suele ser el LCP. Sin `fetchpriority` el navegador la trata
                como una imagen más y la pide después del resto; declarándola
                alta, la pide apenas descubre la etiqueta.
                `decoding="async"` evita que decodificarla bloquee el hilo
                principal mientras se pinta el texto de al lado. */}
            <img
              /* Por ruta y no importada, por lo mismo que el monograma: un import termina
                 empotrando los 17 KB de la foto dentro del HTML prerenderizado, y encima el
                 navegador la vuelve a descargar al hidratar. Ver `tests/imagenesServidas.test.js`. */
              src={"/agustin.webp"}
              alt={`${BRAND.person}, profesor particular`}
              width="800"
              height="1069"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>
              <strong>{BRAND.person}</strong>
              <span>Tu profesor de confianza</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Autoridad en números, apenas termina el hero. */}
      <Credentials />

      {/* ── Materias ── */}
      <section className="section" aria-labelledby="home-subjects">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Reconocés tu situación acá"
            title="Materias principales"
            titleId="home-subjects"
            lead="Los temas que más complican, dichos sin vueltas. Y muchas otras materias a consultar."
          />

          <ol className="subj-list" data-reveal-group="70">
            {SUBJECTS.map((s, i) => (
              <li key={s.slug} data-reveal="up">
                <Link
                  to="/materias"
                  className="subj-row"
                  style={{ "--subject-color": s.color }}
                >
                  <span className="subj-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="subj-copy">
                    <span className="display display--md subj-name">
                      {s.label}
                    </span>
                    <span className="subj-tagline">
                      <b>{s.tagline}</b> {s.hook}
                    </span>
                  </span>
                  <FaArrowRight className="subj-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>

          <p className="subj-more" data-reveal="up">
            ¿No ves tu materia?{" "}
            <a
              href={waLink(
                "Hola Agustín, necesito ayuda con una materia que no veo en tu sitio. ¿Me podés ayudar?",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" /> Escribime y lo vemos juntos
            </a>
          </p>
        </div>
      </section>

      {/* Corte tipográfico: rompe la cadena de grillas y da aire. */}
      <PullQuote />

      {/* ── Cómo trabajo ── */}
      <section className="section" aria-labelledby="home-method">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Cómo trabajo"
            /* Título y lead distintos de los de /como-trabajo, que es la dueña
               del método. Antes los dos eran idénticos palabra por palabra, y con
               eso Google tenía que elegir cuál de las dos páginas indexar para el
               mismo contenido: competían entre sí en lugar de sumar. */
            title="El mismo recorrido con cada alumno"
            titleId="home-method"
            lead="Cuatro etapas, en este orden, sin improvisar sobre la marcha."
          />
          {/* Compacto: solo los títulos de los cuatro pasos. El texto completo
              vive en /como-trabajo y estaba duplicado acá carácter por carácter,
              lo que hacía que las dos páginas compitieran por el mismo contenido
              en lugar de sumar. */}
          <MethodSteps compacto />
          <p className="hp-method-mas" data-reveal="up">
            <Link to="/como-trabajo">
              Cómo funciona cada paso
              <FaArrowRight aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ── La voz de Agustín ─────────────────────────────────────────────────
          Un solo momento en la portada, y va acá a propósito: recién se explicó
          CÓMO trabaja, y este es el pivote al POR QUÉ. Es lo único de la página
          que la competencia no puede copiar, porque son sus palabras.

          Va sin número de sección: no es un capítulo más del recorrido, es un
          corte. El desarrollo completo vive en /sobre-mi y desde acá se enlaza,
          en lugar de duplicarlo —que es el error que ya hizo competir entre sí a
          la portada y a /como-trabajo por el mismo contenido—. */}
      <section className="section section--dark" aria-labelledby="home-voz">
        <div className="shell hp-voz">
          <p className="hp-voz-kicker">En primera persona</p>
          <h2 id="home-voz" className="display display--md hp-voz-titulo">
            Mi meta es que <em>dejes de necesitarme</em>
          </h2>

          <div className="hp-voz-cuerpo" data-reveal="up">
            <p className="hp-voz-cita">{LA_AUTONOMIA.citas[0]}</p>
            <p className="hp-voz-prueba">{LA_AUTONOMIA.prueba}</p>
          </div>

          {/* La frase que dicen los alumnos. Es el material más potente del sitio:
              quien lo lee ya se lo escuchó decir a su hijo. */}
          <div className="hp-voz-dolor" data-reveal="up">
            <p className="hp-voz-dolor-intro">Lo que más escucho:</p>
            <p className="hp-voz-dolor-frase">«{LO_QUE_SE_ESCUCHAN[0]}»</p>
            <p className="hp-voz-dolor-respuesta">
              Eso no describe una capacidad. Describe un tema anterior que quedó
              flojo y a nadie se le ocurrió volver a mirar.
            </p>
          </div>

          <p className="hp-method-mas" data-reveal="up">
            <Link to="/sobre-mi">
              Conocé a Agustín
              <FaArrowRight aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ── Niveles ── */}
      <section className="section section--soft" aria-labelledby="home-levels">
        <div className="shell">
          <SectionHead
            index="03"
            kicker="Sin importar dónde estés"
            title="Todos los niveles"
            titleId="home-levels"
            lead='No hay nivel "demasiado básico" ni "demasiado avanzado". Se arranca desde donde estás vos.'
          />

          {/* Lista editorial en lugar de grilla: la sección anterior y la
              siguiente ya usan cajas, y tres grillas seguidas cansan. */}
          <ol className="lvl-list" data-reveal-group="70">
            {LEVELS.map((l, i) => (
              <li key={l.label} data-reveal="up">
                <span className="lvl-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Ilustracion className="lvl-ilus" src={l.ilustracion} lado={240} />
                <h3 className="display display--md lvl-name">{l.label}</h3>
                <p className="lvl-desc">{l.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Por qué ── */}
      <section className="section" aria-labelledby="home-why">
        <div className="shell">
          <SectionHead
            index="04"
            kicker="Lo que hace la diferencia"
            title="Por qué esto funciona cuando lo otro no"
            titleId="home-why"
            lead="A veces alcanza con una clase bien enfocada para que todo lo que veías borroso tenga sentido. Estas son las condiciones con las que trabajo siempre."
          />

          <ul className="why-grid" data-reveal-group="80">
            {REASONS.map((r) => (
              <li key={r.title} className="why-card" data-reveal="up">
                <Ilustracion className="why-ilus" src={r.ilustracion} />
                <h3 className="why-title">{r.title}</h3>
                <p className="why-desc">{r.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 05 · LA PRUEBA ───────────────────────────────────────────────────
          Va DESPUÉS del argumento (04) y ANTES de las preguntas (06), y el orden
          es el punto: 04 dice por qué esto funciona, 05 muestra qué de eso se
          puede comprobar, y recién ahí 06 barre las dudas que queden. Poner la
          prueba después de las preguntas la deja llegando cuando la persona ya
          decidió.

          NO HAY TESTIMONIOS TODAVÍA, y esta sección está armada para eso: el
          bloque de testimonios sólo existe si hay alguno. Un `<h2>` con nada
          abajo es peor que no tener la sección.

          La nota que explica la ausencia va al final y en chico, a propósito.
          Abrir con "no tengo testimonios" le planta la ausencia al lector antes
          de que la note; omitirla tampoco sirve, porque en un sitio de clases
          particulares es lo primero que se busca. Se dice, pero después de la
          prueba, y dicha así deja de ser un agujero: es el mismo tipo que avisa
          cuando no puede ayudarte. */}
      <section className="section" aria-labelledby="home-prueba">
        <div className="shell">
          <SectionHead
            index="05"
            kicker={PRUEBA.kicker}
            title={PRUEBA.title}
            titleId="home-prueba"
            lead={PRUEBA.lead}
          />

          <ul className="prueba-lista" data-reveal-group="80">
            {PRUEBA.hechos.map((h) => (
              <li key={h.dato} className="prueba-item" data-reveal="up">
                <h3 className="prueba-dato">{h.dato}</h3>
                <p className="prueba-detalle">{h.detalle}</p>
              </li>
            ))}
          </ul>

          {hayTestimonios() && (
            <ul className="prueba-testimonios" data-reveal-group="80">
              {TESTIMONIOS.map((t) => (
                <li key={t.texto} className="prueba-testimonio" data-reveal="up">
                  <blockquote className="prueba-testimonio-texto">{t.texto}</blockquote>
                  <p className="prueba-testimonio-quien">
                    {t.nombre ? `${t.nombre} — ${t.quien}` : t.quien}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <aside className="prueba-nota" data-reveal="up">
            <h3 className="prueba-nota-titulo">{PRUEBA.nota.titulo}</h3>
            <p className="prueba-nota-texto">{PRUEBA.nota.texto}</p>
          </aside>
        </div>
      </section>

      {/* ── Preguntas ── cierra las dudas antes del CTA final. */}
      <section className="section section--soft" aria-labelledby="home-faq">
        <div className="shell">
          <SectionHead
            index="06"
            kicker="Antes de reservar"
            title="Preguntas frecuentes"
            titleId="home-faq"
            lead="Lo que casi todos quieren saber antes de la primera clase."
          />
          <FaqList />
        </div>
      </section>

      <CtaBlock />
    </>
  );
};

export default Home;
