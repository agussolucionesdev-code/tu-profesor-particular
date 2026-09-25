import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import Ilustracion from "../components/Ilustracion.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BRAND, CONTACT, REASONS } from "../data/site.js";
import {
  A_UNA_MADRE,
  COMO_COBRO,
  COMO_EXPLICO,
  EL_CASO,
  FORMACION,
  LA_AUTONOMIA,
  LO_QUE_SE_ESCUCHAN,
  POR_QUE_ENSENO,
  PRIMERA_CLASE,
} from "../data/voz.js";
import "./Inner.css";

const About = () => {
  usePageMeta("/sobre-mi");

  return (
    <>
      <section className="section pagehead" aria-labelledby="about-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Sobre mí"
            title="Quién es Agustín"
            titleId="about-title"
            as="h1"
            lead="No le reservás a una app: le reservás a una persona que se sienta con vos hasta que el tema hace clic."
          />

          <div className="about-grid">
            <figure className="about-photo" data-entrada="up" style={{ "--i": 2 }}>
              <img
                /* Por ruta y no importada, por lo mismo que el monograma: un import termina
                   empotrando los 17 KB de la foto dentro del HTML prerenderizado, y encima el
                   navegador la vuelve a descargar al hidratar. Ver `tests/imagenesServidas.test.js`. */
                src={"/agustin.webp"}
                alt={`${BRAND.person} dando clases particulares`}
                width="800"
                height="1069"
                /* Primer pliegue: es lo más grande de la pantalla. `lazy` la
                   pedía tarde y Lighthouse la marcaba como el LCP demorado. */
                fetchPriority="high"
                decoding="async"
              />
            </figure>

            <div className="about-copy">
              <p className="about-bio" data-entrada="up" style={{ "--i": 3 }}>
                Soy {BRAND.person} y hace más de{" "}
                <b>{BRAND.yearsTeaching} años</b> doy clases particulares.
                Acompaño a estudiantes de primaria, secundaria, secundaria
                técnica, terciario y universitario en Matemáticas, Física,
                Fisicoquímica, Química e Inglés, entre otras materias.
              </p>
              <p className="about-bio" data-entrada="up" style={{ "--i": 3 }}>
                Mi forma de enseñar es simple: que{" "}
                <b>entiendas de verdad, no que memorices para zafar.</b> La
                mayoría de los que llegan no tienen un problema de capacidad;
                tienen un tema anterior que quedó flojo y nadie se detuvo a
                revisarlo. Ahí empezamos.
              </p>
              <p className="about-bio" data-entrada="up" style={{ "--i": 4 }}>
                Doy clases <b>online</b> por videollamada y{" "}
                <b>presenciales</b> en {CONTACT.addressLine}. Cada clase tiene
                orden, cercanía y un plan pensado para vos.
              </p>

              <dl className="about-stats" data-entrada="up" style={{ "--i": 5 }}>
                <div>
                  <dt>+{BRAND.yearsTeaching}</dt>
                  <dd>años acompañando alumnos</dd>
                </div>
                <div>
                  <dt>5+</dt>
                  <dd>materias principales, y más a consultar</dd>
                </div>
                <div>
                  <dt>Todos</dt>
                  <dd>los niveles, de primaria a universitario</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 · POR QUÉ ENSEÑO ──────────────────────────────────────────────
          Va inmediatamente después de la foto y la bio, y antes que cualquier
          argumento de servicio, porque es el único momento del sitio en el que
          alguien lo CONOCE. Todo lo demás se puede leer en tres páginas de la
          competencia; esto no. */}
      <section className="section" aria-labelledby="about-why-teach">
        <div className="shell">
          <SectionHead
            index="02"
            kicker={POR_QUE_ENSENO.kicker}
            title={POR_QUE_ENSENO.title}
            titleId="about-why-teach"
            lead={POR_QUE_ENSENO.origen}
          />

          <div className="con-ilus">
            <div className="voz-bloque" data-reveal="up">
              {POR_QUE_ENSENO.parrafos.map((p) => (
                <p className="voz-cita" key={p.cita}>{p.cita}</p>
              ))}
              <p className="voz-firma">{POR_QUE_ENSENO.cierre}</p>
            </div>
            <Ilustracion className="con-ilus-imagen" src="/img/sobremi-el-clic.webp" />
          </div>

          {/* EL MOMENTO MÁS IMPORTANTE DE LA PÁGINA.
              No es una frase de marketing: son las palabras exactas que los
              alumnos usan para describirse, citadas por él. Quien las lee ya se
              las escuchó decir a su hijo — y esa es toda la fuerza. */}
          <div className="voz-dolor" data-reveal="up">
            <p className="voz-dolor-intro">Lo que más escucho, todavía hoy:</p>
            <ul className="voz-dolor-lista">
              {LO_QUE_SE_ESCUCHAN.map((frase) => (
                <li key={frase}>{frase}</li>
              ))}
            </ul>
            <p className="voz-dolor-respuesta">
              Ninguna de esas frases describe una capacidad. Describen un tema
              anterior que quedó flojo y a nadie se le ocurrió volver a mirar.
              <b> Ahí empezamos.</b>
            </p>
          </div>
        </div>
      </section>

      {/* ── 03 · LA AUTONOMÍA ────────────────────────────────────────────────
          El diferencial de verdad, y va en fondo oscuro porque es la idea que
          tiene que quedar. Es contracomercial —su objetivo es que dejes de
          necesitarlo— y por eso se cree. */}
      <section className="section section--dark" aria-labelledby="about-autonomia">
        <div className="shell">
          <SectionHead
            index="03"
            kicker={LA_AUTONOMIA.kicker}
            title={LA_AUTONOMIA.title}
            titleId="about-autonomia"
          />
          <div className="con-ilus">
            <div className="voz-bloque" data-reveal="up">
              {LA_AUTONOMIA.citas.map((cita) => (
                <p className="voz-cita" key={cita}>{cita}</p>
              ))}
              <p className="voz-prueba">{LA_AUTONOMIA.prueba}</p>
            </div>
            <Ilustracion className="con-ilus-imagen" src="/img/sobremi-autonomia.webp" />
          </div>
        </div>
      </section>

      {/* ── 04 · EL MÉTODO Y EL CASO ─────────────────────────────────────────
          Va después de la autonomía a propósito: primero la promesa grande,
          después la prueba concreta de que no es una frase. La lista de método
          es verificable en la primera clase, así que no hay que creerla. */}
      <section className="section" aria-labelledby="about-metodo">
        <div className="shell">
          <SectionHead
            index="04"
            kicker={COMO_EXPLICO.kicker}
            title={COMO_EXPLICO.title}
            titleId="about-metodo"
          />
          <div className="voz-bloque" data-reveal="up">
            {COMO_EXPLICO.citas.map((cita) => (
              <p className="voz-cita" key={cita}>{cita}</p>
            ))}
          </div>

          <article className="voz-caso" data-reveal="up">
            <h3>{EL_CASO.title}</h3>
            <p className="voz-caso-entrada">{EL_CASO.entrada}</p>
            <ul className="voz-caso-metodo">
              {EL_CASO.metodo.map((paso) => (
                <li key={paso}>{paso}</li>
              ))}
            </ul>
            <p className="voz-caso-cierre">{EL_CASO.cierre}</p>
          </article>
        </div>
      </section>

      {/* ── 05 · LA PRIMERA CLASE ────────────────────────────────────────────
          Baja la ansiedad de quien no sabe qué está comprando. Va como
          secuencia y no como promesa: se puede contrastar. */}
      <section className="section section--soft" aria-labelledby="about-primera">
        <div className="shell">
          <div className="con-ilus con-ilus--encabezado">
            <SectionHead
              index="05"
              kicker={PRIMERA_CLASE.kicker}
              title={PRIMERA_CLASE.title}
              titleId="about-primera"
            />
            <Ilustracion className="con-ilus-imagen" src="/img/sobremi-primera-clase.webp" />
          </div>
          <ol className="voz-pasos" data-reveal-group="80">
            {PRIMERA_CLASE.pasos.map((paso, i) => (
              <li key={paso.titulo} data-reveal="up">
                <span className="voz-paso-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </li>
            ))}
          </ol>
          <p className="voz-puerta" data-reveal="up">{PRIMERA_CLASE.puertaAbierta}</p>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="about-why">
        <div className="shell">
          <SectionHead
            index="06"
            kicker="Cómo es trabajar conmigo"
            title="Lo que podés esperar"
            titleId="about-why"
            lead="Nada de letra chica: estas son las condiciones con las que trabajo siempre."
          />
          <ul className="plain-grid" data-reveal-group="80">
            {REASONS.map((r) => (
              <li key={r.title} data-reveal="up">
                <Ilustracion className="plain-ilus" src={r.ilustracion} />
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 07 · LO QUE NO TE COBRO ──────────────────────────────────────────
          Va pegado a las condiciones porque es la misma conversación, y va
          antes de la formación porque el dinero es lo que más ruido hace: si
          queda sin responder, lo demás se lee con desconfianza. */}
      <section className="section" aria-labelledby="about-cobro">
        <div className="shell">
          <SectionHead
            index="07"
            kicker={COMO_COBRO.kicker}
            title={COMO_COBRO.title}
            titleId="about-cobro"
            lead={COMO_COBRO.cita}
          />
          <ul className="plain-grid" data-reveal-group="80">
            {COMO_COBRO.items.map((item) => (
              <li key={item.titulo} data-reveal="up">
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 08 · SI ESTÁS PREOCUPADA ─────────────────────────────────────────
          Última sección antes del CTA, y es deliberado: le habla a la persona
          que más probablemente esté leyendo esto a las once de la noche.
          La segunda cita —«Y si no, lo digo con la mano en el corazón»— es
          lo último que conviene leer antes de decidir: alguien que avisa cuándo
          NO puede ayudarte es alguien a quien le podés creer cuando dice que sí. */}
      <section className="section section--dark" aria-labelledby="about-madre">
        <div className="shell">
          <SectionHead
            index="08"
            kicker={A_UNA_MADRE.kicker}
            title={A_UNA_MADRE.title}
            titleId="about-madre"
          />
          <div className="voz-bloque" data-reveal="up">
            {A_UNA_MADRE.citas.map((cita) => (
              <p className="voz-cita" key={cita}>{cita}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── 09 · FORMACIÓN ───────────────────────────────────────────────────
          Al final y en formato lista seca. La formación respalda, no convence:
          quien llegó hasta acá ya decidió con lo de arriba, y esto le da la
          razón que necesita para justificar la decisión. */}
      <section className="section section--soft" aria-labelledby="about-formacion">
        <div className="shell">
          <SectionHead
            index="09"
            kicker="Formación"
            title="Dónde estudié y qué estoy estudiando"
            titleId="about-formacion"
            lead="Sigo estudiando. Es parte de por qué esto me sale bien."
          />
          <ul className="voz-formacion" data-reveal-group="60">
            {FORMACION.map((f) => (
              <li key={f.titulo} data-reveal="up">
                <h3>{f.titulo}</h3>
                <p>{f.detalle}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBlock
        title={
          <>
            Empecemos por una clase.
            <br />
            <em>Sin compromiso.</em>
          </>
        }
      />
    </>
  );
};

export default About;
