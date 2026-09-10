import { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck, FaRedo, FaTimes, FaWhatsapp } from "react-icons/fa";
import { fetchCandidatosAResena, updatePedidoDeResena } from "../../../api/bookingApi";
import { formatShortDateLabel as formatShortDate } from "../../../utils/bookingFormatters";
import { enlaceDePedidoDeResena } from "../../../constants/pedidoDeResena";

/* ══════════════════════════════════════════════════════════════════════════
   PEDIR RESEÑAS.

   El sitio institucional publica una sección que dice, textualmente, que
   todavía no hay testimonios y que cuando alguien autorice uno va a estar ahí.
   Esta pantalla es lo que hace que esa frase no quede en promesa.

   LO QUE HACE Y LO QUE NO HACE, que es la decisión de diseño entera:

   NO manda nada. Arma la lista, ordena por quién tiene más para contar, escribe
   el mensaje, y abre WhatsApp para que lo mande Agustín. La máquina se ocupa de
   acordarse; la persona se ocupa de pedir.

   No es pereza: es la única forma que convierte. El mail es opcional al
   reservar —hay clientes que no lo tienen cargado—, el canal del negocio es
   WhatsApp, y un pedido de favor personal mandado por un sistema se nota en el
   primer renglón. Todo el proyecto viene trabajando para que se note que atrás
   hay una persona; automatizar esto sería lo primero que lo delataría.

   TRES BOTONES Y NADA MÁS. La tentación acá es un CRM: etapas, recordatorios,
   métricas de conversión. Para alguien que va a abrir esta pantalla una vez por
   mes, cada control de más es una razón para no volver a abrirla. Se pide, y
   después se marca qué pasó.
══════════════════════════════════════════════════════════════════════════ */

const ESTADO_ETIQUETAS = {
  "sin pedir": "Sin pedir",
  pedida: "Ya se la pedí",
  publicada: "Publicada",
  "no quiere": "No quiere",
};

/* Cuántos días tienen que pasar para que insistir sea razonable. No hay ninguna
   ciencia acá: es el tiempo que hace que "te lo recuerdo" no suene a apuro. */
const DIAS_PARA_INSISTIR = 45;

const diasDesde = (fecha) => {
  if (!fecha) return Infinity;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
};

const PedidosDeResenaView = ({ authConfig }) => {
  const [candidatos, setCandidatos] = useState([]);
  const [incluirPedidas, setIncluirPedidas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState("");
  const [aviso, setAviso] = useState("");
  const secuencia = useRef(0);

  const cargar = useCallback(async (conPedidas) => {
    const propia = ++secuencia.current;
    setCargando(true);
    setError("");
    try {
      const respuesta = await fetchCandidatosAResena(
        conPedidas ? { incluirPedidas: "true" } : {},
        authConfig,
      );
      /* Descarta respuestas viejas: tocar el filtro dos veces rápido puede hacer
         que la primera llegue después de la segunda y pise la lista buena. */
      if (propia !== secuencia.current) return;
      setCandidatos(respuesta?.data?.data || []);
    } catch {
      if (propia !== secuencia.current) return;
      setError("No pudimos cargar la lista. Intentá de nuevo.");
    } finally {
      if (propia === secuencia.current) setCargando(false);
    }
  }, [authConfig]);

  useEffect(() => { cargar(incluirPedidas); }, [cargar, incluirPedidas]);

  const marcar = async (candidato, status) => {
    setGuardando(candidato.id);
    setAviso("");
    try {
      await updatePedidoDeResena(candidato.id, { status }, authConfig);
      /* Se saca de la lista en el acto en vez de recargar todo: el servidor ya lo
         va a filtrar en la próxima carga, y una recarga completa hace parpadear
         una lista donde se está trabajando ítem por ítem. */
      setCandidatos((previos) => (
        status === "sin pedir" || (status === "pedida" && incluirPedidas)
          ? previos.map((c) => (
            c.id === candidato.id
              ? { ...c, reviewRequest: { ...c.reviewRequest, status } }
              : c
          ))
          : previos.filter((c) => c.id !== candidato.id)
      ));
      setAviso(`${candidato.displayName}: ${ESTADO_ETIQUETAS[status].toLowerCase()}.`);
    } catch {
      setError("No pudimos guardar el cambio. Intentá de nuevo.");
    } finally {
      setGuardando("");
    }
  };

  /* Abre WhatsApp con el mensaje escrito Y marca "pedida" en el mismo gesto.
     Son dos acciones y podrían ser dos botones, pero separarlas garantiza que a
     la tercera semana la mitad de la lista esté mal marcada: nadie vuelve al
     panel a registrar lo que ya hizo. */
  const pedir = (candidato) => {
    window.open(
      enlaceDePedidoDeResena({
        telefonoDigits: candidato.telefonoDigits,
        nombreContacto: candidato.contactoNombre,
        nombreAlumno: candidato.displayName,
        esResponsable: candidato.esResponsable,
        materias: candidato.materias,
      }),
      "_blank",
      "noopener,noreferrer",
    );
    marcar(candidato, "pedida");
  };

  return (
    <section className="admin-card" aria-busy={cargando}>
      {/* Sin botón en el encabezado: en mobile el panel estira
          .admin-secondary-btn al 100% del ancho, y ahí el botón parte el título
          en dos líneas. "Actualizar" baja a la barra, donde además está al lado
          del contador que es lo que uno mira antes de recargar. */}
      <div className="admin-card-header">
        <div>
          <span className="card-kicker">Prueba social</span>
          <h3>Pedir reseñas</h3>
        </div>
      </div>

      <p className="resenas-intro">
        Alumnos con dos clases dadas o más, ordenados por quién tiene más para
        contar. El mensaje se abre escrito en tu WhatsApp: lo mandás vos.
      </p>

      <div className="admin-toolbar">
        <label className="resenas-filtro">
          <input
            type="checkbox"
            checked={incluirPedidas}
            onChange={(evento) => setIncluirPedidas(evento.target.checked)}
          />
          <span>Mostrar también a los que ya les pedí</span>
        </label>
        <div className="resenas-barra-fin">
          <p className="admin-search-count" aria-live="polite">
            {candidatos.length} {candidatos.length === 1 ? "persona" : "personas"}
          </p>
          <button
            type="button"
            className="resena-cerrar"
            onClick={() => cargar(incluirPedidas)}
            disabled={cargando}
          >
            <FaRedo aria-hidden="true" /> Actualizar
          </button>
        </div>
      </div>

      {aviso && <p className="resenas-aviso" role="status">{aviso}</p>}

      {cargando && <p className="admin-view-loading" role="status">Buscando candidatos…</p>}

      {!cargando && error && (
        <div className="student-load-error" role="alert">
          <p>{error}</p>
          <button type="button" className="admin-secondary-btn" onClick={() => cargar(incluirPedidas)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && candidatos.length === 0 && (
        /* El vacío explica POR QUÉ está vacío. "No hay resultados" a secas deja a
           quien lo lee sin saber si está roto o si de verdad no hay nadie. */
        <p className="empty-copy">
          Todavía no hay nadie con dos clases dadas registradas. La lista se arma con
          las clases marcadas <strong>Presente</strong> en la agenda: si diste clases
          y no aparecen acá, revisá que estén marcadas.
        </p>
      )}

      {!cargando && !error && candidatos.length > 0 && (
        <ul className="resenas-lista">
          {candidatos.map((candidato) => {
            const estado = candidato.reviewRequest?.status || "sin pedir";
            const yaPedida = estado === "pedida";
            const dias = diasDesde(candidato.reviewRequest?.updatedAt);
            return (
              <li key={candidato.id} className="resena-item">
                <div className="resena-item-top">
                  <div>
                    <strong>{candidato.contactoNombre || candidato.displayName}</strong>
                    {candidato.esResponsable && (
                      <span className="resena-vinculo">
                        {candidato.vinculo || "responsable"} de {candidato.displayName}
                      </span>
                    )}
                  </div>
                  <span className="resena-clases">
                    {candidato.clasesDadas} clase{candidato.clasesDadas !== 1 ? "s" : ""}
                  </span>
                </div>

                <p className="resena-detalle">
                  {candidato.materias.length > 0 && <>{candidato.materias.join(", ")} · </>}
                  {candidato.ultimaClase
                    ? `última el ${formatShortDate(new Date(candidato.ultimaClase))}`
                    : "sin fecha registrada"}
                </p>

                {yaPedida && (
                  <p className="resena-estado">
                    Pedida hace {dias} día{dias !== 1 ? "s" : ""}.
                    {dias >= DIAS_PARA_INSISTIR
                      ? " Ya pasó tiempo suficiente para volver a preguntar."
                      : " Dale tiempo antes de insistir."}
                  </p>
                )}

                {candidato.reviewRequest?.notes && (
                  <p className="resena-notas">{candidato.reviewRequest.notes}</p>
                )}

                <div className="resena-acciones">
                  <button
                    type="button"
                    className="admin-whatsapp-btn resena-pedir"
                    onClick={() => pedir(candidato)}
                    disabled={guardando === candidato.id || !candidato.telefonoDigits}
                  >
                    <FaWhatsapp aria-hidden="true" />
                    {yaPedida ? "Volver a escribirle" : "Escribirle por WhatsApp"}
                  </button>

                  {/* Los dos cierres posibles. "No quiere" es definitivo y por eso
                      está escrito así y no como "descartar": lo que se registra es
                      la decisión de la persona, no una acción de gestión. */}
                  <button
                    type="button"
                    className="resena-cerrar"
                    onClick={() => marcar(candidato, "publicada")}
                    disabled={guardando === candidato.id}
                  >
                    <FaCheck aria-hidden="true" /> Ya la publiqué
                  </button>
                  <button
                    type="button"
                    className="resena-cerrar resena-no"
                    onClick={() => marcar(candidato, "no quiere")}
                    disabled={guardando === candidato.id}
                  >
                    <FaTimes aria-hidden="true" /> No quiere
                  </button>
                </div>

                {!candidato.telefonoDigits && (
                  <p className="resena-sin-telefono">
                    Sin teléfono cargado. {candidato.email || "Tampoco hay mail."}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* El paso que falta después de recibir la reseña, escrito donde se va a
          necesitar. Publicar es a mano y a propósito: el texto va al repositorio
          junto con el permiso registrado (`web/src/data/prueba.js`), y esa
          revisión es lo único que impide publicar las palabras de alguien que no
          dijo que sí. */}
      <aside className="resenas-nota">
        <h4>Cuando te llegue una</h4>
        <p>
          Pasámela con lo que te haya contestado sobre publicarla y sobre si quiere
          que aparezca su nombre. Va al sitio tal cual la escribió, con el permiso
          registrado al lado. Sin ese permiso no se publica.
        </p>
      </aside>
    </section>
  );
};

export default PedidosDeResenaView;
