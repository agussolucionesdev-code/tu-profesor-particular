import { useRef } from "react";
import "./Magnetic.css";

/**
 * Envoltorio "magnético": el elemento se atrae suavemente hacia el cursor
 * mientras el mouse está encima, y vuelve a su lugar al salir. El clásico gesto
 * kinético tipo Awwwards, hecho con transform + una transición suave (sensación
 * gooey/premium). rAF para no saturar; se anula con prefers-reduced-motion y en
 * dispositivos sin puntero fino (touch no dispara mousemove, así que queda
 * inerte solo).
 *
 * strength < 1 mantiene el elemento bajo el cursor (no se escapa). Envuelve en
 * un inline-flex para no alterar el layout del hijo.
 *
 * @param {number} strength  Fracción del desplazamiento cursor→centro (def .28).
 * @param {string} [className]
 */
const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const Magnetic = ({ children, strength = 0.28, className = "" }) => {
  const ref = useRef(null);
  const rafRef = useRef(0);

  const handleMove = (event) => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = event.clientX - (rect.left + rect.width / 2);
    const my = event.clientY - (rect.top + rect.height / 2);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `translate(${(mx * strength).toFixed(1)}px, ${(my * strength).toFixed(1)}px)`;
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    el.style.transform = "translate(0px, 0px)";
  };

  return (
    <span
      ref={ref}
      className={`magnetic ${className}`.trim()}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </span>
  );
};

export default Magnetic;
