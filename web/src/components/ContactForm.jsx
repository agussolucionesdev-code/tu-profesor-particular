import { useId, useRef, useState } from "react";
import {
  FaCircleCheck,
  FaCircleExclamation,
  FaPaperPlane,
  FaWhatsapp,
} from "react-icons/fa6";
import { CONTACT, waLink } from "../data/site.js";
import "./ContactForm.css";

/* Formulario de contacto propio.
 *
 * /contacto era 100% enlaces salientes: WhatsApp, email, mapa. Los tres andan
 * bien, pero comparten un supuesto: que la persona quiere abrir otra app y dar su
 * teléfono ahora. Quien está en una computadora ajena, o todavía no quiere dar el
 * número, o simplemente prefiere escribir y seguir navegando, no tenía forma de
 * dejar sus datos. Se iba.
 *
 * Los ASUNTOS son los mismos cuatro del catálogo del backend, y son cerrados: el
 * valor termina en el asunto de un email que sale del servidor.
 */

const ASUNTOS = [
  { value: "clases", label: "Consulta por clases" },
  { value: "horarios", label: "Horarios y disponibilidad" },
  { value: "precios", label: "Precios" },
  { value: "otro", label: "Otra cosa" },
];

const MAXIMO_MENSAJE = 5000;
const MINIMO_MENSAJE = 10;

/* La API vive en el backend de Render, que es otro origen. Su CORS ya acepta este
 * dominio desde el código —no desde una variable de entorno— justamente para que
 * este formulario no dependa de que alguien se acuerde de configurarla.
 *
 * El mismo patrón que usa la app de turnos en apiClient.js: variable de entorno
 * con fallback según el modo. Hardcodear la URL de producción dejaba el
 * formulario imposible de probar en local, que es donde se lo prueba.
 *
 * `import.meta.env` NO existe cuando este módulo corre en Node durante el
 * prerender: ahí `import.meta` está definido pero sin `env`, así que leerlo
 * directo tiraba un TypeError. React atrapaba ese error, devolvía la página vacía
 * y el build seguía sin avisar — /contacto se publicó con solo el header y el
 * footer. Por eso se lee con optional chaining. */
const ENV = import.meta.env ?? {};
const API_BASE =
  ENV.VITE_BACKEND_URL ||
  (ENV.PROD
    ? "https://tu-profesor-particular-backend.onrender.com"
    : "http://localhost:4100");
const API = `${API_BASE}/api/contact`;

const ESTADO = { QUIETO: "quieto", ENVIANDO: "enviando", OK: "ok", ERROR: "error" };

const VACIO = { name: "", email: "", phone: "", subject: "clases", message: "", website: "" };

const ContactForm = () => {
  const [datos, setDatos] = useState(VACIO);
  const [estado, setEstado] = useState(ESTADO.QUIETO);
  const [mensajeEstado, setMensajeEstado] = useState("");
  const [tocado, setTocado] = useState(false);
  /* Ref además del estado: dos clics rápidos en Enviar entran antes de que React
     vuelva a renderizar, y el segundo pasaría el chequeo. Serían dos emails. */
  const enviandoRef = useRef(false);
  const idBase = useId();

  const enviando = estado === ESTADO.ENVIANDO;
  const idDe = (campo) => `${idBase}-${campo}`;

  /* Validación en el cliente para no hacer viajar un pedido que va a fallar. La
     que manda es la del servidor: esta es una cortesía, no una defensa. */
  const errores = {
    name: datos.name.trim().length < 2 ? "Poné tu nombre para saber cómo llamarte." : "",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())
      ? "Revisá el email: sin una dirección válida no puedo responderte."
      : "",
    message:
      datos.message.trim().length < MINIMO_MENSAJE
        ? "Contame un poco más: qué materia, qué nivel y qué te está costando."
        : "",
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const cambiar = (campo) => (evento) => {
    setDatos((prev) => ({ ...prev, [campo]: evento.target.value }));
    // Un cartel de "enviado" sobre un formulario ya editado miente.
    if (estado === ESTADO.OK || estado === ESTADO.ERROR) {
      setEstado(ESTADO.QUIETO);
      setMensajeEstado("");
    }
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setTocado(true);
    if (hayErrores || enviandoRef.current) return;

    enviandoRef.current = true;
    setEstado(ESTADO.ENVIANDO);
    setMensajeEstado("Enviando tu mensaje…");

    try {
      const respuesta = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const cuerpo = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setEstado(ESTADO.ERROR);
        setMensajeEstado(
          cuerpo.message ||
            "No pudimos enviar el mensaje. Probá de nuevo o escribime por WhatsApp.",
        );
        return;
      }

      setEstado(ESTADO.OK);
      setMensajeEstado(
        cuerpo.message || "Mensaje enviado. Te voy a responder a la brevedad.",
      );
      // Se limpia todo menos nada: si alguien quiere escribir otra consulta,
      // arranca de cero; y así el mensaje enviado no queda a la vista como si
      // no se hubiera ido.
      setDatos(VACIO);
      setTocado(false);
    } catch {
      /* Sin respuesta del servidor: red caída, o Render despertando —está en el
         plan gratuito y el primer pedido puede tardar—. En los dos casos el
         mensaje no se perdió: sigue escrito en el formulario. */
      setEstado(ESTADO.ERROR);
      setMensajeEstado(
        "No pudimos conectarnos. Tu mensaje sigue acá: probá de nuevo en un momento o escribime por WhatsApp.",
      );
    } finally {
      enviandoRef.current = false;
    }
  };

  const campoInvalido = (campo) => tocado && Boolean(errores[campo]);

  return (
    <form className="cf" onSubmit={enviar} noValidate>
      <div className="cf-grid">
        <p className="cf-field">
          <label className="cf-label" htmlFor={idDe("name")}>
            Tu nombre <span aria-hidden="true">*</span>
          </label>
          <input
            id={idDe("name")}
            className={`cf-input ${campoInvalido("name") ? "is-invalid" : ""}`}
            value={datos.name}
            onChange={cambiar("name")}
            autoComplete="name"
            maxLength={80}
            required
            aria-invalid={campoInvalido("name")}
            aria-describedby={campoInvalido("name") ? idDe("name-error") : undefined}
            disabled={enviando}
          />
          {campoInvalido("name") && (
            <span className="cf-error" id={idDe("name-error")}>
              {errores.name}
            </span>
          )}
        </p>

        <p className="cf-field">
          <label className="cf-label" htmlFor={idDe("email")}>
            Tu email <span aria-hidden="true">*</span>
          </label>
          <input
            id={idDe("email")}
            className={`cf-input ${campoInvalido("email") ? "is-invalid" : ""}`}
            type="email"
            value={datos.email}
            onChange={cambiar("email")}
            autoComplete="email"
            maxLength={160}
            required
            aria-invalid={campoInvalido("email")}
            aria-describedby={campoInvalido("email") ? idDe("email-error") : undefined}
            disabled={enviando}
          />
          {campoInvalido("email") && (
            <span className="cf-error" id={idDe("email-error")}>
              {errores.email}
            </span>
          )}
        </p>

        <p className="cf-field">
          <label className="cf-label" htmlFor={idDe("phone")}>
            Teléfono
          </label>
          <input
            id={idDe("phone")}
            className="cf-input"
            type="tel"
            value={datos.phone}
            onChange={cambiar("phone")}
            autoComplete="tel"
            maxLength={40}
            placeholder="Opcional"
            aria-describedby={idDe("phone-hint")}
            disabled={enviando}
          />
          {/* Decirlo explícitamente: la razón de existir de este formulario es
              justamente no obligar a dar el teléfono. */}
          <span className="cf-hint" id={idDe("phone-hint")}>
            Solo si querés que te llame o te escriba por WhatsApp.
          </span>
        </p>

        <p className="cf-field">
          <label className="cf-label" htmlFor={idDe("subject")}>
            ¿De qué se trata?
          </label>
          <select
            id={idDe("subject")}
            className="cf-input"
            value={datos.subject}
            onChange={cambiar("subject")}
            disabled={enviando}
          >
            {ASUNTOS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </p>
      </div>

      <p className="cf-field cf-field--full">
        <label className="cf-label" htmlFor={idDe("message")}>
          Contame tu situación <span aria-hidden="true">*</span>
        </label>
        <textarea
          id={idDe("message")}
          className={`cf-input cf-textarea ${campoInvalido("message") ? "is-invalid" : ""}`}
          value={datos.message}
          onChange={cambiar("message")}
          rows={5}
          maxLength={MAXIMO_MENSAJE}
          required
          placeholder="Ej: mi hija está en 3er año y viene con dificultades en Matemática. Tiene prueba en dos semanas."
          aria-invalid={campoInvalido("message")}
          aria-describedby={
            campoInvalido("message") ? idDe("message-error") : idDe("message-hint")
          }
          disabled={enviando}
        />
        {campoInvalido("message") ? (
          <span className="cf-error" id={idDe("message-error")}>
            {errores.message}
          </span>
        ) : (
          <span className="cf-hint" id={idDe("message-hint")}>
            Cuanto más concreto, mejor te puedo responder. Materia, nivel y qué
            está costando alcanza.
          </span>
        )}
      </p>

      {/* El campo trampa. Una persona no lo ve nunca; los bots rellenan todo lo
          que encuentran y el servidor descarta el envío si viene con algo.
          aria-hidden y tabIndex -1 para que un lector de pantalla y el teclado lo
          salteen: si no, sería una trampa para quien navega sin ver.
          Se oculta con CSS y no con `type="hidden"` porque muchos bots ignoran
          los hidden y sí completan los inputs de texto. */}
      <div className="cf-trampa" aria-hidden="true">
        <label htmlFor={idDe("website")}>No completar</label>
        <input
          id={idDe("website")}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={datos.website}
          onChange={cambiar("website")}
        />
      </div>

      <div className="cf-pie">
        <button type="submit" className="cf-enviar" disabled={enviando}>
          {enviando ? (
            "Enviando…"
          ) : (
            <>
              <FaPaperPlane aria-hidden="true" /> Enviar mensaje
            </>
          )}
        </button>
        <span className="cf-privacidad">
          Se usa para responderte y nada más.{" "}
          <a href="/privacidad">Cómo manejo tus datos</a>
        </span>
      </div>

      {/* La región live existe SIEMPRE, aunque esté vacía: un lector de pantalla
          solo anuncia los cambios de una región que ya estaba en el DOM. Si
          apareciera junto con el texto, varios se lo perderían. */}
      <div
        className="cf-estado-live"
        role={estado === ESTADO.ERROR ? "alert" : "status"}
        aria-live={estado === ESTADO.ERROR ? "assertive" : "polite"}
      >
        {mensajeEstado && (
          <p className={`cf-estado cf-estado--${estado}`}>
            {estado === ESTADO.OK && <FaCircleCheck aria-hidden="true" />}
            {estado === ESTADO.ERROR && <FaCircleExclamation aria-hidden="true" />}
            <span>{mensajeEstado}</span>
          </p>
        )}
      </div>

      {/* Si el envío falló, la salida que funciona seguro. No se ofrece antes
          para no competir con el formulario que la persona ya empezó. */}
      {estado === ESTADO.ERROR && (
        <p className="cf-salida">
          <FaWhatsapp aria-hidden="true" />
          <a
            href={waLink(
              datos.message.trim()
                ? `Hola Agustín, vengo del sitio y no pude enviar el formulario. ${datos.message.trim()}`
                : "Hola Agustín, vengo del sitio y no pude enviar el formulario.",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mandámelo por WhatsApp al {CONTACT.whatsappDisplay}
          </a>
        </p>
      )}
    </form>
  );
};

export default ContactForm;
