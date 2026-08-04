import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaCheck,
  FaChevronDown,
  FaClock,
  FaGraduationCap,
  FaLaptop,
  FaMapMarkerAlt,
  FaRegCalendarCheck,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import "../index.css";
import "./ClientPortal.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import ThemeLogo from "./ui/ThemeLogo";
import RescheduleModal from "./portal/RescheduleModal";
import CancelModal from "./portal/CancelModal";
import StudentNotesPanel from "./portal/StudentNotesPanel";
import {
  cancelBooking,
  confirmAttendance,
  createPortalSession,
  fetchPortalHistory,
  fetchPublicSettings,
  updateStudentNotes,
} from "../api/bookingApi";
import { clasificarFalla, mensajeDeFalla } from "../api/errorClassification";
import { usePageMeta } from "../hooks/useDocumentTitle";
import {
  FALLBACK_TEACHER_LOCATION,
  parseTeacherLocation,
} from "../constants/teacherLocation";

const WHATSAPP_URL =
  "https://wa.me/5491133365937?text=Hola%20Agust%C3%ADn%2C%20necesito%20ayuda%20con%20un%20turno.";

/* El código nunca lleva I, L, O, 0 ni 1: el alfabeto los excluye justamente
   para que nadie dude entre un uno y una ele al copiarlo de un mail. Se
   normaliza al escribir en vez de rechazar, que es lo que hace la diferencia
   entre "no me anda" y "entré". */
const CODIGO_VALIDO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,12}$/;
const CONFUSIONES = { I: "1", L: "1", O: "0", "1": "1", "0": "0" };

const normalizarCodigo = (valor) =>
  String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const fechaLarga = (iso) => {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};
/* hour12:false a propósito: es-AR devuelve "08:00 p. m." con espacios finos que
   se leen mal en una línea con más datos. Acá se dice 20:00, como en la calle. */
const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const anio = (iso) => new Date(iso).getFullYear();

/* Cuánto falta, en palabras. Un turno "en 3 días" se entiende de un vistazo;
   una fecha sola obliga a hacer la cuenta mentalmente. */
const cuantoFalta = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return null;
  const horas = Math.round(ms / 3600000);
  if (horas < 1) return "en menos de una hora";
  if (horas < 24) return horas === 1 ? "en 1 hora" : `en ${horas} horas`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "mañana";
  if (dias < 7) return `en ${dias} días`;
  const semanas = Math.round(dias / 7);
  return semanas === 1 ? "en 1 semana" : `en ${semanas} semanas`;
};

const esCancelado = (b) => String(b.status || "").toLowerCase() === "cancelado";
const esPendiente = (b) => String(b.status || "").toLowerCase() === "pendiente";

/* ══════════════════════════════════════════════════════════════════════════
   Pantalla de entrada
   ══════════════════════════════════════════════════════════════════════════ */
const Entrada = ({ onEntrar, cargando, error }) => {
  const [codigo, setCodigo] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const listo = CODIGO_VALIDO.test(codigo);
  /* Avisar del carácter confuso ANTES de que la persona toque el botón y le
     rebote: si escribió una O es casi seguro que en el papel dice cero. */
  const confuso = [...codigo].find((c) => "ILO01".includes(c));

  return (
    <div className="pt-gate">
      <div className="pt-gate-card">
        <ThemeLogo
          variant="monogram"
          imgClassName="pt-gate-logo"
          alt="Tu Profesor Particular"
        />
        <h1 className="pt-gate-title">Tus turnos</h1>
        <p className="pt-gate-lead">
          Escribí el código que te dimos al reservar y entrás directo. Ahí vas a
          ver todas tus clases y vas a poder cambiarlas o cancelarlas.
        </p>

        <form
          className="pt-gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (listo && !cargando) onEntrar(codigo);
          }}
        >
          <label className="pt-gate-label" htmlFor="pt-codigo">
            Código de reserva
          </label>
          <input
            id="pt-codigo"
            ref={inputRef}
            className="pt-gate-input"
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            placeholder="A3K9PQ"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
            inputMode="text"
            aria-describedby="pt-codigo-ayuda"
            aria-invalid={Boolean(error)}
          />
          <p className="pt-gate-hint" id="pt-codigo-ayuda">
            {confuso ? (
              <span className="pt-gate-hint--warn">
                Ojo: el código no lleva {confuso === "1" || confuso === "0"
                  ? `${confuso === "1" ? "unos" : "ceros"}`
                  : `la letra ${confuso}`}
                . Si dudás, probá con {CONFUSIONES[confuso] === "1" ? "un 1" : "un 0"}
                {confuso === "1" ? " una I o una L" : confuso === "0" ? " una O" : ""}.
              </span>
            ) : (
              "Son 6 caracteres. Está en el mail de confirmación y en tu comprobante."
            )}
          </p>

          <button
            type="submit"
            className="pt-gate-btn"
            disabled={!listo || cargando}
          >
            {cargando ? "Entrando…" : "Ver mis turnos"}
            {!cargando && <FaArrowRight aria-hidden="true" />}
          </button>
        </form>

        {error && (
          <p className="pt-gate-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <a
        className="pt-gate-help"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaWhatsapp aria-hidden="true" />
        <span>¿Perdiste el código?</span>
        <strong>Escribinos y te lo pasamos</strong>
      </a>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   Tarjeta de turno
   ══════════════════════════════════════════════════════════════════════════ */
const TarjetaTurno = ({
  turno,
  esActual,
  onReprogramar,
  onCancelar,
  onConfirmar,
  onGuardarNotas,
  confirmando,
  ubicacion,
}) => {
  const [abierto, setAbierto] = useState(false);
  const cancelado = esCancelado(turno);
  const falta = turno.isPast || cancelado ? null : cuantoFalta(turno.timeSlot);
  const gestionable = !turno.isPast && !cancelado;
  const detalleId = `pt-detalle-${turno.bookingCode}`;

  /* El chip decía "Confirmado" a cualquier turno que no estuviera cancelado ni
     hubiera pasado, sin mirar `turno.status`. Un turno Pendiente —el estado en
     que entran TODAS las reservas cuando el profesor pide confirmación manual—
     se mostraba como confirmado. Eso es peor que no tener el botón: quien lo
     leía nunca iba a buscar cómo confirmarlo, porque la app ya le había dicho
     que estaba listo. */
  const pendiente = esPendiente(turno);
  const estado = cancelado
    ? { texto: "Cancelado", clase: "is-cancelado" }
    : turno.isPast
      ? { texto: "Ya pasó", clase: "is-pasado" }
      : pendiente
        ? { texto: "Falta confirmar", clase: "is-pendiente" }
        : { texto: "Confirmado", clase: "is-confirmado" };

  return (
    <li className={`pt-turno ${cancelado ? "is-cancelado" : ""} ${turno.isPast ? "is-pasado" : ""}`}>
      <div className="pt-turno-main">
        {/* El día grande a la izquierda: es el dato que se busca primero. */}
        <div className="pt-turno-fecha" aria-hidden="true">
          <span className="pt-turno-dia">{new Date(turno.timeSlot).getDate()}</span>
          <span className="pt-turno-mes">
            {MESES[new Date(turno.timeSlot).getMonth()].slice(0, 3)}
          </span>
        </div>

        <div className="pt-turno-cuerpo">
          <div className="pt-turno-linea">
            <h3 className="pt-turno-materia">{turno.subject}</h3>
            <span className={`pt-chip ${estado.clase}`}>{estado.texto}</span>
            {esActual && <span className="pt-chip is-actual">Con el que entraste</span>}
          </div>

          <p className="pt-turno-cuando">
            <FaCalendarAlt aria-hidden="true" />
            <span className="pt-turno-cuando-txt">
              {fechaLarga(turno.timeSlot)} de {anio(turno.timeSlot)}
            </span>
            <span className="pt-turno-sep" aria-hidden="true">·</span>
            <FaClock aria-hidden="true" />
            <span>
              {hora(turno.timeSlot)} a {hora(turno.endTime)}
            </span>
            {falta && <span className="pt-turno-falta">{falta}</span>}
          </p>

          <p className="pt-turno-meta">
            <span>
              {turno.modality === "presencial" ? (
                <>
                  <FaMapMarkerAlt aria-hidden="true" /> Presencial
                </>
              ) : (
                <>
                  <FaLaptop aria-hidden="true" /> Online
                </>
              )}
            </span>
            {/* La dirección, enlazada al mapa, y solo en los turnos que todavía
                no pasaron: en un turno viejo o cancelado es ruido. Acá es donde
                alguien la busca de verdad —el día antes de la clase—, y hasta
                ahora el portal decía "Presencial" sin decir dónde. */}
            {turno.modality === "presencial" && gestionable && (
              <a
                className="pt-turno-mapa"
                href={ubicacion.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ubicacion.address}
                <span className="sr-only"> — ver en el mapa (pestaña nueva)</span>
              </a>
            )}
            <span>
              <FaGraduationCap aria-hidden="true" /> {turno.educationLevel}
              {turno.yearGrade ? ` · ${turno.yearGrade}` : ""}
            </span>
            <span className="pt-turno-codigo">#{turno.bookingCode}</span>
          </p>

          {/* Por qué hay que confirmar. Sin esto el botón es una orden sin
              motivo, y quien no entiende para qué sirve no lo toca. */}
          {pendiente && gestionable && (
            <p className="pt-turno-pendiente-aviso">
              Agustín todavía está esperando que confirmes. Avisale que vas y el
              turno queda reservado en firme.
            </p>
          )}
        </div>

        {gestionable && (
          <div className="pt-turno-acciones">
            {/* Confirmar va primero y con el estilo principal: mientras el turno
                esté Pendiente es lo único que hay que hacer, y las otras dos
                acciones pueden esperar. */}
            {pendiente && (
              <button
                type="button"
                className="pt-btn pt-btn--confirmar"
                onClick={() => onConfirmar(turno)}
                disabled={confirmando}
              >
                {confirmando ? (
                  "Confirmando…"
                ) : (
                  <>
                    <FaCheck aria-hidden="true" /> Confirmar que voy
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              className="pt-btn pt-btn--reprogramar"
              onClick={() => onReprogramar(turno)}
            >
              Cambiar horario
            </button>
            <button
              type="button"
              className="pt-btn pt-btn--cancelar"
              onClick={() => onCancelar(turno)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="pt-turno-toggle"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={detalleId}
      >
        <FaChevronDown
          aria-hidden="true"
          className={abierto ? "is-abierto" : undefined}
        />
        {abierto ? "Ocultar detalle" : "Ver detalle"}
      </button>

      {abierto && (
        <dl className="pt-turno-detalle" id={detalleId}>
          <div>
            <dt>Alumno</dt>
            <dd>{turno.studentName}</dd>
          </div>
          <div>
            <dt>A cargo</dt>
            <dd>
              {turno.responsibleName}
              {turno.responsibleRelationship
                ? ` (${turno.responsibleRelationshipOther || turno.responsibleRelationship})`
                : ""}
            </dd>
          </div>
          {turno.school && (
            <div>
              <dt>Escuela</dt>
              <dd>{turno.school}</dd>
            </div>
          )}
          <div>
            <dt>Duración</dt>
            <dd>{turno.duration === 1 ? "1 hora" : `${turno.duration} horas`}</dd>
          </div>
          {turno.academicSituation && (
            <div className="pt-turno-detalle-full">
              <dt>Qué querías trabajar</dt>
              <dd>{turno.academicSituation}</dd>
            </div>
          )}
        </dl>
      )}

      {/* La nota editable, solo en los turnos que todavía se pueden gestionar:
          el backend rechaza escribir en uno cancelado o pasado, así que ofrecer
          el campo ahí sería prometer algo que no se puede cumplir.

          Fuera del <dl> a propósito: una <div> con un textarea adentro no es
          contenido válido de una lista de definiciones, y ahí no hay un término
          y su definición sino un formulario. Se muestra junto al detalle porque
          comparten el mismo gesto de "quiero ver más de este turno". */}
      {abierto && gestionable && (
        <StudentNotesPanel
          booking={turno}
          onGuardar={(notas) => onGuardarNotas(turno, notas)}
        />
      )}
    </li>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   Portal
   ══════════════════════════════════════════════════════════════════════════ */
const ClientPortal = () => {
  usePageMeta(
    "Tus turnos",
    "Entrá con tu código de reserva y gestioná tus clases: consultá, cambiá el horario o cancelá.",
  );

  /* El token vive SOLO acá, en memoria. No va a localStorage ni a la URL: es
     una llave de 30 días y el navegador no es lugar para dejarla. */
  const [token, setToken] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [actual, setActual] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [reprogramando, setReprogramando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [aviso, setAviso] = useState("");
  const [ubicacion, setUbicacion] = useState(FALLBACK_TEACHER_LOCATION);

  /* La dirección del espacio presencial. Es público y no depende del token, así
     que se pide una sola vez al montar y no cuando alguien entra con su código:
     si esta llamada falla, queda el fallback y el portal sigue funcionando. */
  useEffect(() => {
    fetchPublicSettings()
      .then((res) => setUbicacion(parseTeacherLocation(res.data?.data)))
      .catch(() => {});
  }, []);

  const cargarHistorial = useCallback(async (tk) => {
    const { data } = await fetchPortalHistory(tk);
    setTurnos(data?.data?.bookings ?? []);
    setActual(data?.data?.current ?? null);
  }, []);

  const entrar = async (codigo) => {
    setCargando(true);
    setError("");
    try {
      const { data } = await createPortalSession(codigo);
      const tk = data?.data?.managementToken;
      if (!tk) throw new Error("sin token");
      await cargarHistorial(tk);
      setToken(tk);
    } catch (err) {
      /* Un 429 es distinto de un código equivocado y merece decirlo: si no, la
         persona sigue probando su código correcto creyendo que falla. */
      setError(
        err?.response?.status === 429
          ? "Probaste varios códigos seguidos. Esperá unos minutos y volvé a intentar."
          : "Ese código no corresponde a ninguna reserva. Revisalo y probá de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  };

  const refrescar = useCallback(async () => {
    if (!token) return;
    try {
      await cargarHistorial(token);
    } catch {
      setError("No pudimos actualizar la lista. Probá recargar la página.");
    }
  }, [token, cargarHistorial]);

  /* El token de gestión vale para UNA reserva: el backend compara el código del
     pedido contra el de la reserva a la que se emitió. Como el portal lista
     todos los turnos del titular, para tocar uno que no es aquel con el que se
     entró hay que pedir su propio token. El código ya está en la lista, así que
     no se le pide nada más a la persona.

     Se hace así y no ampliando el alcance del token a propósito: cada operación
     sigue autorizada contra su reserva, exactamente como antes. */
  const tokenDeTurno = useCallback(
    async (turno) => {
      if (turno.bookingCode === actual) return token;
      const { data } = await createPortalSession(turno.bookingCode);
      const tk = data?.data?.managementToken;
      if (!tk) throw new Error("sin token");
      return tk;
    },
    [actual, token],
  );

  const abrirGestion = useCallback(
    async (turno, abrir) => {
      try {
        abrir({ turno, tokenDelTurno: await tokenDeTurno(turno) });
      } catch {
        setAviso(
          "No pudimos abrir ese turno. Recargá la página y volvé a intentar.",
        );
      }
    },
    [tokenDeTurno],
  );

  /* Guardar la nota necesita el mismo token por turno que reprogramar y
     cancelar. Se deja acá y no dentro del panel para que el token no baje por
     props hasta un componente de presentación: vive en un solo lugar.

     Se refresca el historial al terminar para que el DTO vuelva con la nota
     guardada. Sin eso, el panel seguiría comparando contra el valor viejo y el
     botón "Guardar nota" quedaría habilitado como si faltara guardar. Los
     errores se dejan propagar: useAccionDeModal dentro del panel los traduce y
     los anuncia, que es donde la persona los está mirando. */
  const guardarNotas = useCallback(
    async (turno, notas) => {
      await updateStudentNotes(turno.bookingCode, notas, await tokenDeTurno(turno));
      await refrescar();
    },
    [tokenDeTurno, refrescar],
  );

  /* Confirmar asistencia: el endpoint existía desde hace tiempo y ninguna
     pantalla lo llamaba, así que un turno Pendiente no tenía forma de pasar a
     Confirmado. Peor: el chip decía "Confirmado" igual, así que nadie sabía que
     faltaba hacer algo.

     No abre modal a propósito. Cancelar y reprogramar sí lo hacen porque son
     irreversibles o cambian el horario; confirmar es aditivo y no destruye
     nada, y pedir una confirmación de la confirmación es fricción sin motivo. */
  const [confirmando, setConfirmando] = useState(null);

  const confirmarAsistencia = useCallback(
    async (turno) => {
      setConfirmando(turno.bookingCode);
      setAviso("");
      try {
        await confirmAttendance(turno.bookingCode, await tokenDeTurno(turno));
        await refrescar();
        setAviso("¡Listo! Tu turno quedó confirmado. Nos vemos en la clase.");
      } catch (error) {
        const falla = error?.falla ?? clasificarFalla(error);
        if (!falla.seMuestra) return;
        setAviso(mensajeDeFalla(falla));
      } finally {
        setConfirmando(null);
      }
    },
    [tokenDeTurno, refrescar],
  );

  const { proximos, pasados } = useMemo(() => {
    const p = [];
    const q = [];
    for (const t of turnos) (t.isPast || esCancelado(t) ? q : p).push(t);
    // Los pasados, del más reciente hacia atrás: interesa lo último primero.
    q.sort((a, b) => new Date(b.timeSlot) - new Date(a.timeSlot));
    return { proximos: p, pasados: q };
  }, [turnos]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!token) {
    return (
      <div className="pt-shell">
        <Entrada onEntrar={entrar} cargando={cargando} error={error} />
      </div>
    );
  }

  return (
    <div className="pt-shell">
      <main className="pt-main">
        <header className="pt-head">
          <div className="pt-head-copy">
            <p className="pt-kicker">Tus turnos</p>
            <h1 className="pt-titulo">
              {proximos.length > 0
                ? proximos.length === 1
                  ? "Tenés una clase por delante"
                  : `Tenés ${proximos.length} clases por delante`
                : "No tenés clases próximas"}
            </h1>
            {proximos[0] && (
              <p className="pt-head-sub">
                La más cercana es {proximos[0].subject},{" "}
                {cuantoFalta(proximos[0].timeSlot)}.
              </p>
            )}
          </div>
          <button
            type="button"
            className="pt-salir"
            onClick={() => {
              setToken(null);
              setTurnos([]);
              setError("");
            }}
          >
            <FaTimes aria-hidden="true" /> Salir
          </button>
        </header>

        {/* La región live se renderiza SIEMPRE, aunque esté vacía. Antes se
            montaba junto con su contenido, y un lector de pantalla solo anuncia
            los cambios de una región que ya existía en el DOM: si aparece al
            mismo tiempo que el texto, varios se lo pierden. El que cambia es el
            contenido, no el contenedor. */}
        <div role="status" aria-live="polite">
          {aviso && (
            <p className="pt-aviso">
              <FaRegCalendarCheck aria-hidden="true" />
              {aviso}
            </p>
          )}
        </div>

        {proximos.length > 0 && (
          <section aria-labelledby="pt-proximos">
            <h2 className="pt-seccion" id="pt-proximos">
              Próximas clases
            </h2>
            <ul className="pt-lista" role="list">
              {proximos.map((t) => (
                <TarjetaTurno
                  key={t.bookingCode}
                  turno={t}
                  esActual={t.bookingCode === actual}
                  onReprogramar={(t) => abrirGestion(t, setReprogramando)}
                  onCancelar={(t) => abrirGestion(t, setCancelando)}
                  onConfirmar={confirmarAsistencia}
                  onGuardarNotas={guardarNotas}
                  confirmando={confirmando === t.bookingCode}
                  ubicacion={ubicacion}
                />
              ))}
            </ul>
          </section>
        )}

        {proximos.length === 0 && (
          <div className="pt-vacio">
            <FaRegCalendarCheck aria-hidden="true" />
            <p>No tenés ninguna clase agendada por ahora.</p>
            <a className="pt-btn pt-btn--reservar" href="/reservar">
              Reservar una clase <FaArrowRight aria-hidden="true" />
            </a>
          </div>
        )}

        {pasados.length > 0 && (
          <section aria-labelledby="pt-pasados">
            <h2 className="pt-seccion" id="pt-pasados">
              Historial
              <span className="pt-seccion-cuenta">
                {pasados.length} {pasados.length === 1 ? "clase" : "clases"}
              </span>
            </h2>
            <ul className="pt-lista pt-lista--historial" role="list">
              {pasados.map((t) => (
                <TarjetaTurno
                  key={t.bookingCode}
                  turno={t}
                  esActual={t.bookingCode === actual}
                  onReprogramar={(t) => abrirGestion(t, setReprogramando)}
                  onCancelar={(t) => abrirGestion(t, setCancelando)}
                  onConfirmar={confirmarAsistencia}
                  onGuardarNotas={guardarNotas}
                  confirmando={confirmando === t.bookingCode}
                  ubicacion={ubicacion}
                />
              ))}
            </ul>
          </section>
        )}

        <a
          className="pt-help"
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp aria-hidden="true" />
          <span>¿Necesitás algo que no está acá?</span>
          <strong>Escribinos por WhatsApp</strong>
        </a>
      </main>

      {reprogramando && (
        <RescheduleModal
          editingBooking={reprogramando.turno}
          managementToken={reprogramando.tokenDelTurno}
          onClose={() => setReprogramando(null)}
          onSuccess={async () => {
            setReprogramando(null);
            setAviso("Listo, tu clase quedó en el nuevo horario.");
            await refrescar();
          }}
          showToast={(msg) => setAviso(msg)}
        />
      )}

      {cancelando && (
        <CancelModal
          cancelingBooking={cancelando.turno}
          onClose={() => setCancelando(null)}
          onConfirm={async () => {
            await cancelBooking(
              { bookingCode: cancelando.turno.bookingCode },
              cancelando.tokenDelTurno,
            );
            setCancelando(null);
            setAviso("Tu clase quedó cancelada.");
            await refrescar();
          }}
        />
      )}
    </div>
  );
};

export default ClientPortal;
