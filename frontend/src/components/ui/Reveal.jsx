import useInView from "../../hooks/useInView";
import { createElement } from "react";

/**
 * @component Reveal
 * @description Wrapper que aplica la animación de scroll reveal al
 * primer hijo. El contenido entra al viewport con un fade + deslizamiento.
 * Respeta prefers-reduced-motion (motion-system.css lo cancela vía media query).
 *
 * @param {Object}    props
 * @param {ReactNode} props.children
 * @param {"up"|"left"|"right"|"scale"|"fade"} [props.direction="up"]
 * @param {number}    [props.delay=0]          - ms de delay adicional al CSS
 * @param {number}    [props.threshold=0.12]   - 0–1, cuánto del elemento debe
 *                                               ser visible para disparar
 * @param {boolean}   [props.once=true]        - Animar solo la primera vez
 * @param {string}    [props.className]        - Clases extra al wrapper
 * @param {string}    [props.as="div"]         - Elemento HTML a renderizar
 *
 * @example
 * <Reveal direction="left" delay={120}>
 *   <article className="card">…</article>
 * </Reveal>
 *
 * // Sin wrapper extra (el hijo recibe las clases directamente via cloneElement):
 * <Reveal as={null}>
 *   <p>Texto que aparece al hacer scroll</p>
 * </Reveal>
 */
const Reveal = ({
  children,
  direction = "up",
  delay = 0,
  threshold = 0.12,
  once = true,
  className = "",
  as: Tag = "div",
}) => {
  const [ref, isVisible] = useInView({ threshold, once });

  const directionClass =
    direction === "up"    ? "reveal reveal-up"    :
    direction === "left"  ? "reveal reveal-left"  :
    direction === "right" ? "reveal reveal-right" :
    direction === "scale" ? "reveal reveal-scale" :
    direction === "fade"  ? "reveal reveal-fade"  :
                            "reveal";

  const style = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

  return createElement(
    Tag,
    {
      ref,
      className: `${directionClass}${isVisible ? " is-visible" : ""}${className ? ` ${className}` : ""}`,
      style,
    },
    children,
  );
};

export default Reveal;
