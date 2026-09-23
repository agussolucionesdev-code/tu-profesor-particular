import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FaSearch, FaArrowRight, FaPencilAlt } from "react-icons/fa";
import {
  buscarMaterias,
  consultaEsCBC,
  normalizar,
  CBC,
  MAS_PEDIDAS,
} from "../../constants/materiasSuperior";
import "./BuscadorDeMateria.css";

/* ══════════════════════════════════════════════════════════════════════════
   EL BUSCADOR DE MATERIAS DE NIVEL SUPERIOR.

   POR QUÉ EXISTE

   Primaria tiene 5 materias y Secundaria 7: entran en una grilla de tarjetas
   y se eligen mirando. Terciario y Universitario no: la misma materia se
   llama distinto en cada facultad —"Matemática" en el CBC, "Análisis
   Matemático I" en Exactas, "Álgebra y Geometría Analítica" en la UTN— y una
   grilla que intentara cubrir eso tendría cien tarjetas que no recorre nadie.

   Acá se escribe y la lista se filtra sola.

   POR QUÉ ES UN COMBOBOX Y NO UN <datalist>

   El `<input list>` nativo parece la solución obvia y es una trampa: Safari
   lo trata distinto, en varios navegadores sólo matchea por prefijo —así que
   quien escribe "lineal" nunca encuentra "Álgebra Lineal"—, no se puede
   estilar, y en Android el comportamiento cambia según el teclado. Esto es el
   patrón combobox de ARIA hecho a mano, que se comporta igual en todos lados.

   LO QUE NO HACE, A PROPÓSITO

   No ofrece materias que Agustín no da. Quien busca Antropología no la
   encuentra: cae en "escribir otra materia", y ahí él decide si la toma. Ver
   el comentario largo en `constants/materiasSuperior.js`.
   ══════════════════════════════════════════════════════════════════════════ */

/* Resalta en negrita el pedazo que la persona escribió, para que se vea POR QUÉ
   apareció ese resultado. Compara sobre el texto normalizado pero recorta sobre
   el original, así no se pierden las tildes en pantalla. */
function ConNegrita({ texto, consulta }) {
  const q = normalizar(consulta);
  if (!q) return texto;
  const i = normalizar(texto).indexOf(q);
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + q.length)}</mark>
      {texto.slice(i + q.length)}
    </>
  );
}

export default function BuscadorDeMateria({
  nivel,
  valor = "",
  onElegir,
  autoFocus = false,
}) {
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [libreAbierto, setLibreAbierto] = useState(false);
  const [libre, setLibre] = useState("");

  const idBase = useId();
  const idLista = `${idBase}-lista`;
  const opcionId = (i) => `${idBase}-op-${i}`;

  const campoRef = useRef(null);
  const contRef = useRef(null);

  const resultados = useMemo(() => buscarMaterias(consulta), [consulta]);
  const mostrarCBC = useMemo(
    () => consulta.length === 0 || consultaEsCBC(consulta),
    [consulta],
  );

  /* Todo lo que depende de lo tipeado se resuelve ACÁ, en el mismo evento que
     cambió el texto, y no en un efecto que reacciona después.

     La primera versión lo hacía con `useEffect([consulta])` y el linter tenía
     razón en rechazarlo: un setState dentro de un efecto provoca un segundo
     render en cascada por cada tecla. En un buscador que se dispara letra por
     letra eso se siente.

     El resaltado vuelve arriba en cada cambio a propósito: si no, al borrar una
     letra quedaba marcada una fila que ya no existía y Enter elegía otra cosa. */
  const alCambiar = (e) => {
    const texto = e.target.value;
    setConsulta(texto);
    setActivo(-1);
    setAbierto(texto.trim().length >= 2);
  };

  /* Clic afuera cierra. Sin esto la lista queda flotando sobre el resto del
     paso y tapa el botón de continuar. */
  useEffect(() => {
    const alClic = (e) => {
      if (contRef.current && !contRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, []);

  const elegir = (nombre) => {
    onElegir?.(nombre);
    setConsulta("");
    setAbierto(false);
    setActivo(-1);
    setLibreAbierto(false);
  };

  const alTeclear = (e) => {
    if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setAbierto(true);
      return;
    }
    if (!resultados.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? resultados.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activo >= 0) {
        e.preventDefault();
        elegir(resultados[activo].nombre);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
      setActivo(-1);
    }
  };

  const confirmarLibre = () => {
    const limpio = libre.trim();
    if (limpio.length < 2) return;
    elegir(limpio);
    setLibre("");
  };

  return (
    <div className="bmat" ref={contRef}>
      {/* ── el campo ─────────────────────────────────────────────────────── */}
      <label className="bmat-label" htmlFor={`${idBase}-campo`}>
        ¿Qué materia necesitás?
      </label>
      <p className="bmat-ayuda">
        Escribí el nombre como figura en tu plan de estudios. Por ejemplo{" "}
        <em>análisis matemático</em>, <em>álgebra</em> o <em>química orgánica</em>.
      </p>

      <div className={`bmat-campo ${abierto ? "is-abierto" : ""}`}>
        <FaSearch className="bmat-lupa" aria-hidden="true" />
        <input
          id={`${idBase}-campo`}
          ref={campoRef}
          type="text"
          className="bmat-input"
          /* El foco lo dibuja el contenedor (.bmat-campo:focus-within). Sin esta
             marca, la regla global de campos le sumaba su propio halo y quedaban
             dos recuadros, uno adentro del otro. */
          data-foco="contenedor"
          placeholder="Buscar materia…"
          value={consulta}
          onChange={alCambiar}
          onKeyDown={alTeclear}
          onFocus={() => consulta.length >= 2 && setAbierto(true)}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? opcionId(activo) : undefined}
        />
      </div>

      {/* Cuántos resultados hay, para quien no ve la lista. `polite` para que
          no interrumpa mientras sigue tipeando. */}
      <span className="sr-only" role="status" aria-live="polite">
        {abierto && consulta.length >= 2
          ? `${resultados.length} ${resultados.length === 1 ? "materia encontrada" : "materias encontradas"}`
          : ""}
      </span>

      {/* ── resultados ───────────────────────────────────────────────────── */}
      <ul
        id={idLista}
        role="listbox"
        aria-label="Materias encontradas"
        className={`bmat-lista ${abierto && resultados.length ? "is-visible" : ""}`}
      >
        {resultados.map((m, i) => (
          <li
            key={m.nombre}
            id={opcionId(i)}
            role="option"
            aria-selected={i === activo}
            className={`bmat-op ${i === activo ? "is-activa" : ""}`}
            onMouseEnter={() => setActivo(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir(m.nombre)}
          >
            <span className="bmat-op-nombre">
              <ConNegrita texto={m.nombre} consulta={consulta} />
            </span>
            <span className="bmat-op-familia">{m.familia}</span>
          </li>
        ))}
      </ul>

      {/* Nada encontrado: no es un callejón sin salida, es la puerta a
          escribirla a mano. */}
      {abierto && consulta.length >= 2 && !resultados.length && (
        <div className="bmat-vacio" role="status">
          <p>
            No tengo <strong>“{consulta}”</strong> en la lista.
          </p>
          <button
            type="button"
            className="bmat-btn-libre"
            onClick={() => {
              setLibre(consulta);
              setLibreAbierto(true);
              setAbierto(false);
            }}
          >
            <FaPencilAlt aria-hidden="true" /> Escribirla igual
          </button>
        </div>
      )}

      {/* ── las más pedidas: las materias principales, a un toque ─────────── */}
      {consulta.length === 0 && !libreAbierto && (
        <section className="bmat-rapidas" aria-labelledby={`${idBase}-rapidas`}>
          <h3 id={`${idBase}-rapidas`} className="bmat-rapidas-titulo">
            Las más pedidas
          </h3>
          <div className="bmat-rapidas-chips">
            {MAS_PEDIDAS.map((nombre) => (
              <button
                key={nombre}
                type="button"
                className={`bmat-rapida ${valor === nombre ? "is-elegida" : ""}`}
                onClick={() => elegir(nombre)}
                aria-pressed={valor === nombre}
              >
                {nombre}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── el CBC, destacado ────────────────────────────────────────────── */}
      {mostrarCBC && !libreAbierto && (
        <section className="bmat-cbc" aria-labelledby={`${idBase}-cbc`}>
          <div className="bmat-cbc-cabeza">
            <span className="bmat-cbc-sello">UBA</span>
            <div>
              <h3 id={`${idBase}-cbc`} className="bmat-cbc-titulo">
                {CBC.titulo}
              </h3>
              <p className="bmat-cbc-bajada">{CBC.bajada}</p>
            </div>
          </div>
          <div className="bmat-cbc-chips">
            {CBC.materias.map((nombre) => (
              <button
                key={nombre}
                type="button"
                className={`bmat-chip ${valor === nombre ? "is-elegida" : ""}`}
                onClick={() => elegir(nombre)}
                aria-pressed={valor === nombre}
              >
                {nombre.replace(" (CBC)", "")}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── escribir otra ────────────────────────────────────────────────── */}
      {!libreAbierto ? (
        <button
          type="button"
          className="bmat-otra"
          onClick={() => setLibreAbierto(true)}
        >
          <FaPencilAlt aria-hidden="true" />
          No está en la lista, la escribo yo
        </button>
      ) : (
        <div className="bmat-libre">
          <label className="bmat-label" htmlFor={`${idBase}-libre`}>
            Escribí tu materia
          </label>
          <div className="bmat-libre-fila">
            <input
              id={`${idBase}-libre`}
              type="text"
              className="bmat-input bmat-input-libre"
              value={libre}
              maxLength={120}
              placeholder="Por ejemplo: Estadística Aplicada"
              onChange={(e) => setLibre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmarLibre()}
            />
            <button
              type="button"
              className="bmat-confirmar"
              onClick={confirmarLibre}
              disabled={libre.trim().length < 2}
            >
              Usar esta <FaArrowRight aria-hidden="true" />
            </button>
          </div>
          <p className="bmat-nota">
            Agustín te confirma por WhatsApp si puede tomarla antes de cobrarte nada.
          </p>
        </div>
      )}

      {/* ── lo elegido ───────────────────────────────────────────────────── */}
      {valor && (
        <p className="bmat-elegida" role="status">
          Elegiste <strong>{valor}</strong> para <strong>{nivel}</strong>.
        </p>
      )}
    </div>
  );
}
