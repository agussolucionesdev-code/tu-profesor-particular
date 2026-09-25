import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./Typewriter.css";

/**
 * Máquina de escribir: escribe una palabra, espera, la borra y sigue con la
 * siguiente, en loop. Se usa para poner en pantalla la frase que el visitante
 * ya pensó ("no entiendo nada de ___"), así se reconoce antes de leer la
 * promesa.
 *
 * Accesibilidad y respeto por el usuario:
 * · Con prefers-reduced-motion no hay animación: se muestra la primera palabra.
 * · El texto animado es aria-hidden y hay una versión completa para lectores de
 *   pantalla, así nadie escucha letra por letra.
 * · Se pausa si la pestaña se oculta (no gasta batería de fondo).
 */
const TYPE_MS = 85;
const ERASE_MS = 40;
const HOLD_MS = 1700;

/* «Reducir movimiento», leído con useSyncExternalStore: durante la
   hidratación vale lo mismo que en el prerender (`false`, el servidor no lo
   sabe) y enseguida el valor real. Leído en el render directo, el primer dibujo
   del navegador no coincidía con el HTML para quien tiene la opción activada. */
const CONSULTA = "(prefers-reduced-motion: reduce)";
const suscribirMovimiento = (avisar) => {
  const m = window.matchMedia?.(CONSULTA);
  m?.addEventListener?.("change", avisar);
  return () => m?.removeEventListener?.("change", avisar);
};
const pideQuietud = () => Boolean(window.matchMedia?.(CONSULTA)?.matches);
const delServidor = () => false;

const Typewriter = ({ words, className = "" }) => {
  const reduced = useSyncExternalStore(suscribirMovimiento, pideQuietud, delServidor);
  const [animado, setText] = useState("");
  const text = reduced ? words[0] : animado;
  const timer = useRef(0);

  useEffect(() => {
    if (reduced) return undefined;

    let wordIndex = 0;
    let charIndex = 0;
    let erasing = false;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;

      // Con la pestaña oculta no tiene sentido animar: se reintenta luego.
      if (document.hidden) {
        timer.current = window.setTimeout(step, 400);
        return;
      }

      const word = words[wordIndex];

      if (!erasing) {
        charIndex += 1;
        setText(word.slice(0, charIndex));
        if (charIndex === word.length) {
          erasing = true;
          timer.current = window.setTimeout(step, HOLD_MS);
          return;
        }
        timer.current = window.setTimeout(step, TYPE_MS);
        return;
      }

      charIndex -= 1;
      setText(word.slice(0, charIndex));
      if (charIndex === 0) {
        erasing = false;
        wordIndex = (wordIndex + 1) % words.length;
      }
      timer.current = window.setTimeout(step, ERASE_MS);
    };

    timer.current = window.setTimeout(step, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [words, reduced]);

  return (
    <span className={`tw ${className}`.trim()}>
      <span aria-hidden="true">{text}</span>
      {/* Sin animación no hace falta el caret: no hay nada escribiéndose. */}
      {!reduced && <span className="tw-caret" aria-hidden="true" />}
      {/* Para lectores de pantalla: la lista completa, sin animación. */}
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
};

export default Typewriter;
