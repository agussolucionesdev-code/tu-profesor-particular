import { useEffect, useState } from "react";
import { FaDollarSign, FaPlus, FaSave, FaTrashAlt } from "react-icons/fa";
import { fetchAdminSettings, updateSetting } from "../../../api/bookingApi";
import { LEVEL_OPTIONS } from "../../../constants/kioskWizard";
import { formatearPesos, resolverTarifa, aplicarDescuento } from "../../../utils/precio";

/* La matriz de precios, editable por el profesor.
 *
 * Existe porque el precio real es una matriz —primaria no vale lo mismo que
 * universitario, y dentro de secundaria las ciencias duras valen más que Lengua— y
 * el sistema guardaba UN solo número. Con un único valor, el estimado del paso 3 salía
 * equivocado para casi toda combinación.
 *
 * Y es editable acá, y no un archivo de código, porque los precios los cambia Agustín
 * cuando quiere. Si cada ajuste dependiera de que yo toque el repositorio, el número
 * publicado iba a quedar viejo — que es exactamente lo que pasó con los años de
 * experiencia, que decían 8 cuando ya eran 10.
 *
 * NO ES UN ESTIMADOR CON IA, que fue la primera idea. La entrada es nivel + materia +
 * duración y la salida es un número: es determinística. Un modelo ahí cotizaría distinto
 * dos veces la misma reserva y podría inventar un precio. Cuando la respuesta se puede
 * escribir como regla, se escribe.
 */

const CLAVE = "booking.pricingMatrix";

const numeroOVacio = (valor) => (valor === "" || valor === null ? "" : Number(valor));

/* Las materias se editan como texto separado por comas: es lo más rápido de cargar y
   de leer de un vistazo, y evita un selector anidado por cada excepción. */
const materiasATexto = (materias) => (Array.isArray(materias) ? materias.join(", ") : "");
const textoAMaterias = (texto) =>
  String(texto || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

const PricingMatrixEditor = ({ authConfig }) => {
  const [porNivel, setPorNivel] = useState({});
  const [excepciones, setExcepciones] = useState([]);
  const [descuento, setDescuento] = useState({ desdeHoras: 2, porcentaje: 10 });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    let vigente = true;
    fetchAdminSettings(authConfig)
      .then((res) => {
        if (!vigente) return;
        const m = res.data?.data?.[CLAVE] ?? {};
        setPorNivel(m.porNivel ?? {});
        setExcepciones(Array.isArray(m.excepciones) ? m.excepciones : []);
        setDescuento(m.descuento ?? { desdeHoras: 2, porcentaje: 10 });
      })
      .catch(() => {
        if (vigente) setAviso({ tipo: "error", texto: "No se pudieron cargar los precios." });
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [authConfig]);

  const matrizActual = {
    porNivel,
    excepciones: excepciones.map((e) => ({
      ...e,
      materias: Array.isArray(e.materias) ? e.materias : textoAMaterias(e.materiasTexto),
    })),
    descuento,
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso({ tipo: "", texto: "" });
    try {
      await updateSetting(CLAVE, matrizActual, authConfig);
      setAviso({ tipo: "ok", texto: "Precios guardados. Ya se ven en el sitio." });
    } catch {
      setAviso({ tipo: "error", texto: "No se pudieron guardar los precios. Reintentá." });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <article className="admin-card settings-card">
        <p className="settings-hint">Cargando precios…</p>
      </article>
    );
  }

  return (
    <article className="admin-card settings-card">
      <div className="admin-card-header">
        <div>
          <span className="card-kicker">Precios</span>
          <h3><FaDollarSign aria-hidden="true" /> Precio por nivel y materia</h3>
        </div>
      </div>

      <p className="availability-hint">
        Es el precio por hora que ve quien reserva, en el paso del turno. Un nivel sin
        precio no muestra nada —nunca aparece «$0», que se leería como «es gratis»— y en
        su lugar dice que el valor se acuerda con vos.
      </p>

      <h4 className="pricing-subtitulo">Por nivel</h4>
      <div className="pricing-grid">
        {LEVEL_OPTIONS.map((nivel) => (
          <label className="kiosk-field" key={nivel.value} htmlFor={`precio-${nivel.value}`}>
            <span className="kiosk-field-label">{nivel.label}</span>
            <input
              id={`precio-${nivel.value}`}
              type="number"
              min="0"
              max="9999999"
              step="500"
              className="settings-input"
              value={porNivel[nivel.value] ?? ""}
              placeholder="Sin precio"
              onChange={(e) =>
                setPorNivel((prev) => ({ ...prev, [nivel.value]: numeroOVacio(e.target.value) }))
              }
            />
          </label>
        ))}
      </div>

      <h4 className="pricing-subtitulo">Materias que valen distinto</h4>
      <p className="availability-hint">
        Cada excepción pisa el precio de su nivel, y sólo del suyo: poner Matemática en
        Secundaria no le cambia el precio a Matemática de Primaria.
      </p>

      {excepciones.length === 0 && (
        <p className="settings-hint">Sin excepciones. Todas las materias valen lo del nivel.</p>
      )}

      {excepciones.map((exc, i) => (
        <div className="pricing-excepcion" key={i}>
          <label className="kiosk-field" htmlFor={`exc-nivel-${i}`}>
            <span className="kiosk-field-label">Nivel</span>
            <select
              id={`exc-nivel-${i}`}
              className="settings-input"
              value={exc.nivel ?? ""}
              onChange={(e) =>
                setExcepciones((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, nivel: e.target.value } : x)),
                )
              }
            >
              <option value="">Elegí un nivel</option>
              {LEVEL_OPTIONS.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </label>

          <label className="kiosk-field" htmlFor={`exc-materias-${i}`}>
            <span className="kiosk-field-label">Materias (separadas por coma)</span>
            <input
              id={`exc-materias-${i}`}
              type="text"
              className="settings-input"
              value={exc.materiasTexto ?? materiasATexto(exc.materias)}
              placeholder="Matemática, Física, Química"
              onChange={(e) =>
                setExcepciones((prev) =>
                  prev.map((x, j) =>
                    j === i
                      ? {
                        ...x,
                        materiasTexto: e.target.value,
                        materias: textoAMaterias(e.target.value),
                      }
                      : x,
                  ),
                )
              }
            />
          </label>

          <label className="kiosk-field" htmlFor={`exc-precio-${i}`}>
            <span className="kiosk-field-label">Precio por hora</span>
            <input
              id={`exc-precio-${i}`}
              type="number"
              min="0"
              step="500"
              className="settings-input"
              value={exc.precio ?? ""}
              onChange={(e) =>
                setExcepciones((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, precio: numeroOVacio(e.target.value) } : x)),
                )
              }
            />
          </label>

          <button
            type="button"
            className="inline-action danger"
            onClick={() => setExcepciones((prev) => prev.filter((_, j) => j !== i))}
            aria-label={`Eliminar excepción ${i + 1}`}
          >
            <FaTrashAlt aria-hidden="true" />
          </button>
        </div>
      ))}

      <button
        type="button"
        className="inline-action"
        onClick={() =>
          setExcepciones((prev) => [...prev, { nivel: "", materias: [], materiasTexto: "", precio: "" }])
        }
      >
        <FaPlus aria-hidden="true" /> Agregar excepción
      </button>

      <h4 className="pricing-subtitulo">Descuento por varias horas</h4>
      <div className="pricing-grid">
        <label className="kiosk-field" htmlFor="descuento-horas">
          <span className="kiosk-field-label">Desde cuántas horas</span>
          <input
            id="descuento-horas"
            type="number"
            min="0"
            max="12"
            step="0.5"
            className="settings-input"
            value={descuento.desdeHoras ?? ""}
            onChange={(e) =>
              setDescuento((prev) => ({ ...prev, desdeHoras: numeroOVacio(e.target.value) }))
            }
          />
        </label>
        <label className="kiosk-field" htmlFor="descuento-porcentaje">
          <span className="kiosk-field-label">Descuento (%)</span>
          <input
            id="descuento-porcentaje"
            type="number"
            min="0"
            max="99"
            step="1"
            className="settings-input"
            value={descuento.porcentaje ?? ""}
            onChange={(e) =>
              setDescuento((prev) => ({ ...prev, porcentaje: numeroOVacio(e.target.value) }))
            }
          />
        </label>
      </div>

      {/* Vista previa con los valores que están en pantalla, ANTES de guardar.
          Una matriz es difícil de leer de memoria: ver qué le va a cobrar de verdad a un
          chico de secundaria por dos horas de Física es lo que convierte esta pantalla
          en algo usable y no en un formulario a ciegas. */}
      <h4 className="pricing-subtitulo">Cómo queda</h4>
      <ul className="pricing-preview">
        {[
          { nivel: "Primaria", materia: "Matemática", horas: 1 },
          { nivel: "Secundaria", materia: "Lengua y Literatura", horas: 1 },
          { nivel: "Secundaria", materia: "Física", horas: 2 },
          { nivel: "Universitario", materia: "Física", horas: 2 },
        ].map((caso) => {
          const base = resolverTarifa(matrizActual, caso);
          const aplicada = base === null ? null : aplicarDescuento(base, caso.horas, descuento);
          return (
            <li key={`${caso.nivel}-${caso.materia}-${caso.horas}`}>
              <strong>{caso.materia}</strong> · {caso.nivel} · {caso.horas} h:{" "}
              {aplicada === null ? (
                <em>a acordar</em>
              ) : (
                <>
                  {formatearPesos(aplicada * caso.horas)}
                  <span className="pricing-preview-hora"> ({formatearPesos(aplicada)}/h)</span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {aviso.texto && (
        <p className={aviso.tipo === "error" ? "kiosk-error" : "kiosk-aviso-suave"} role="status">
          {aviso.texto}
        </p>
      )}

      <button type="button" className="admin-primary-btn" onClick={guardar} disabled={guardando}>
        <FaSave aria-hidden="true" /> {guardando ? "Guardando…" : "Guardar precios"}
      </button>
    </article>
  );
};

export default PricingMatrixEditor;
