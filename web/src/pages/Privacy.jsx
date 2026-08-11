import { Link } from "react-router-dom";
import { FaArrowUpRightFromSquare, FaWhatsapp } from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import {
  BOOKING_MANAGE_URL,
  BOOKING_RESERVE_URL,
  BRAND,
  CONTACT,
  waLink,
} from "../data/site.js";
import "./Inner.css";
import "./Privacy.css";

/* Aviso de privacidad.
 *
 * Existe porque se recolectan datos de personas y, en la mayoría de los casos,
 * de menores de edad: nombre del alumno, su nivel y año, y lo que le está
 * costando de la materia. Eso último es lo más delicado de todo el formulario y
 * es justamente lo que hace falta para dar una clase útil.
 *
 * Todo lo que dice esta página está verificado contra el código, no copiado de
 * una plantilla: los proveedores son los que realmente reciben datos —Gmail vía
 * nodemailer, Google Sheets si está configurado el GOOGLE_SHEET_ID, MongoDB,
 * Render y Vercel—, y los campos son los que efectivamente guarda el modelo
 * Booking. Un aviso que describe un sistema que no es el tuyo es peor que no
 * tener aviso: promete cosas que nadie cumple.
 */
const Privacy = () => {
  usePageMeta("/privacidad");

  return (
    <>
      <section className="section pagehead" aria-labelledby="pv-title">
        <div className="shell">
          <p className="pagehead-kicker">Datos personales</p>
          <h1 id="pv-title" className="display display--lg">
            Qué datos pedimos y qué hacemos con ellos
          </h1>
          <p className="lead">
            Escrito en castellano y sin vueltas. Si algo no te queda claro,{" "}
            <a
              href={waLink(
                "Hola Agustín, tengo una duda sobre el manejo de mis datos.",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              escribime y te lo explico
            </a>
            .
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="pv-quien">
        <div className="shell prose">
          <SectionHead
            index="01"
            kicker="Quién maneja tus datos"
            title="Responsable"
            titleId="pv-quien"
          />
          <p>
            {BRAND.person}, profesor particular, {CONTACT.addressLine}. No hay
            empresa ni terceros vendiendo nada: soy yo el que da las clases y el
            único que ve las fichas de los alumnos.
          </p>
          <p>
            Para cualquier cosa relacionada con tus datos:{" "}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> o WhatsApp al{" "}
            <a
              href={waLink("Hola Agustín, te escribo por mis datos personales.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              {CONTACT.whatsappDisplay}
            </a>
            .
          </p>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="pv-que">
        <div className="shell prose">
          <SectionHead
            index="02"
            kicker="Lo que se pide y para qué"
            title="Qué datos"
            titleId="pv-que"
            lead="Cada campo está porque sin él no se puede dar la clase o no se puede avisar de algo. Nada se pide “por si acaso”."
          />

          <h3>Para reservar una clase</h3>
          <ul className="pv-list">
            <li>
              <strong>Nombre del alumno.</strong> Para saber con quién es la
              clase y llamarlo por su nombre.
            </li>
            <li>
              <strong>Nombre del adulto responsable y su vínculo</strong> cuando
              el alumno es menor. Es quien reserva y con quien se coordina.
            </li>
            <li>
              <strong>Teléfono.</strong> Es la vía real de contacto: por ahí se
              avisa si hay que mover un horario.
            </li>
            <li>
              <strong>Email</strong> (opcional). Solo para mandarte el
              comprobante con el código y el recordatorio de la clase. Si no lo
              dejás, la reserva funciona igual.
            </li>
            <li>
              <strong>Nivel, año o grado, y escuela</strong> (la escuela es
              opcional). Definen el programa y hasta dónde llega el tema.
            </li>
            <li>
              <strong>Qué querés lograr en la clase.</strong> Es el campo más
              importante y el más delicado: lo que escribas acá es lo que me
              permite llegar preparado en lugar de improvisar. Lo leo yo y nadie
              más.
            </li>
          </ul>

          <h3>Después, si querés</h3>
          <ul className="pv-list">
            <li>
              <strong>Notas para el profe.</strong> Desde{" "}
              <a href={BOOKING_MANAGE_URL}>
                Mis Turnos
              </a>{" "}
              podés dejarme una nota antes de la clase. Es opcional y la podés
              borrar cuando quieras.
            </li>
          </ul>

          <h3>Lo que anoto yo</h3>
          <ul className="pv-list">
            <li>
              <strong>Seguimiento de las clases.</strong> Si asistió, cómo viene
              con el tema y qué conviene reforzar. Sirve para no arrancar de cero
              cada vez. Es mi registro de trabajo y no se comparte con nadie.
            </li>
          </ul>

          <div className="pv-callout">
            <h3>Cuando el alumno es menor de edad</h3>
            <p>
              La reserva la hace un adulto responsable, y es ese adulto el que da
              los datos y autoriza el tratamiento. Si sos menor y querés
              reservar, pedile a tu mamá, papá o a quien esté a cargo que lo haga
              o que te acompañe.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="pv-quien-mas">
        <div className="shell prose">
          <SectionHead
            index="03"
            kicker="Nada se vende ni se cede para publicidad"
            title="Quién más los ve"
            titleId="pv-quien-mas"
            lead="Solo los servicios que hacen falta para que esto funcione. Están listados con nombre y con el motivo."
          />
          <div className="pv-table-wrap">
            <table className="pv-table">
              <caption className="sr-only">
                Servicios que procesan datos y para qué
              </caption>
              <thead>
                <tr>
                  <th scope="col">Servicio</th>
                  <th scope="col">Para qué</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Gmail (Google)</th>
                  <td>
                    Enviar el comprobante de la reserva, los avisos de cambio o
                    cancelación y el recordatorio de la clase.
                  </td>
                </tr>
                <tr>
                  <th scope="row">MongoDB Atlas</th>
                  <td>
                    Es la base donde se guardan las reservas y el seguimiento.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Render</th>
                  <td>Servidor donde corre el sistema de turnos.</td>
                </tr>
                <tr>
                  <th scope="row">Vercel</th>
                  <td>Servidor donde están este sitio y la app de turnos.</td>
                </tr>
                <tr>
                  <th scope="row">Google Sheets</th>
                  <td>
                    Copia de la agenda en una planilla propia, cuando está
                    activada. Sirve para trabajar la agenda fuera del sistema.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Medición de visitas</h3>
          <p>
            Este sitio usa Vercel Analytics y Speed Insights, que cuentan visitas
            y miden qué tan rápido carga.{" "}
            <strong>
              No usan cookies ni arman un identificador para seguirte
            </strong>
            : se eligió justamente por eso, en lugar de Google Analytics. La app
            de turnos no tiene ninguna medición.
          </p>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="pv-cuanto">
        <div className="shell prose">
          <SectionHead
            index="04"
            kicker="Cuánto tiempo"
            title="Conservación"
            titleId="pv-cuanto"
          />
          <p>
            Las reservas y el seguimiento se conservan mientras siga la relación
            de clases, porque sirven para retomar donde quedamos. Si dejás de
            tomar clases y querés que borre todo, me lo pedís y lo borro.
          </p>
          <p>
            Los comprobantes que ya se enviaron por email quedan en tu casilla y
            en la mía: eso no lo puedo borrar por vos.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="pv-derechos">
        <div className="shell prose">
          <SectionHead
            index="05"
            kicker="Lo que podés pedir"
            title="Tus derechos"
            titleId="pv-derechos"
            lead="Son tuyos por la Ley 25.326 de Protección de los Datos Personales y no hace falta explicar para qué los querés."
          />
          <ul className="pv-list">
            <li>
              <strong>Ver</strong> qué datos tengo tuyos.
            </li>
            <li>
              <strong>Corregir</strong> lo que esté mal o desactualizado.
            </li>
            <li>
              <strong>Borrar</strong> lo que ya no quieras que tenga.
            </li>
          </ul>
          <p>
            Escribime a{" "}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> y te
            respondo. Si necesitás una parte de esto ya mismo, buena parte la
            resolvés sola desde{" "}
            <a href={BOOKING_MANAGE_URL}>
              Mis Turnos
            </a>
            : con tu código de reserva ves todos tus turnos y podés cambiarlos,
            cancelarlos o borrar la nota que hayas dejado.
          </p>
          <p className="pv-aaip">
            Si te parece que no te respondí como corresponde, podés reclamar ante
            la{" "}
            <a
              href="https://www.argentina.gob.ar/aaip"
              target="_blank"
              rel="noopener noreferrer"
            >
              Agencia de Acceso a la Información Pública
              <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
            , que es el organismo de control en Argentina.
          </p>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="pv-cambios">
        <div className="shell prose">
          <SectionHead
            index="06"
            kicker="Si esto cambia"
            title="Actualizaciones"
            titleId="pv-cambios"
          />
          <p>
            Si en algún momento cambia qué datos se piden o qué servicios se
            usan, se actualiza esta página. No hay letra chica en otro lado: esto
            es todo.
          </p>
          <p className="pv-cta-row">
            <Link className="btn btn--ghost" to="/contacto">
              Ir a Contacto
            </Link>
            <a
              className="btn btn--primary"
              href={BOOKING_RESERVE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Reservar una clase
              <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
          </p>
          <p className="pv-help">
            <FaWhatsapp aria-hidden="true" />
            <a
              href={waLink(
                "Hola Agustín, tengo una duda sobre el aviso de privacidad.",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preguntame lo que quieras por WhatsApp
            </a>
          </p>
        </div>
      </section>
    </>
  );
};

export default Privacy;
