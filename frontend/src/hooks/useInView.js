import { useEffect, useRef, useState } from "react";

/**
 * @hook useInView
 * @description Detecta si un elemento DOM entró al viewport usando
 * IntersectionObserver. Cuando `once` es true (default), deja de observar
 * tras la primera aparición. Si el browser no soporta IntersectionObserver,
 * devuelve isVisible=true de inmediato (graceful degradation).
 *
 * @param {Object}  [options]
 * @param {number}  [options.threshold=0.12]   - Porcentaje visible para disparar
 * @param {string}  [options.rootMargin="0px"]  - Margen alrededor del viewport
 * @param {boolean} [options.once=true]         - Animar solo la primera vez
 * @param {number}  [options.delay=0]           - ms de retraso antes de marcar visible
 *
 * @returns {[React.RefObject, boolean]}
 *
 * @example
 * const [ref, isVisible] = useInView({ threshold: 0.15 });
 * return <div ref={ref} className={`reveal ${isVisible ? "is-visible" : ""}`} />;
 */
const useInView = ({
  threshold = 0.12,
  rootMargin = "0px",
  once = true,
  delay = 0,
} = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(
    // Graceful degradation: si no hay IntersectionObserver, todo visible
    typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (delay > 0) {
            const id = setTimeout(() => setIsVisible(true), delay);
            if (once) {
              observer.disconnect();
            }
            return () => clearTimeout(id);
          } else {
            setIsVisible(true);
            if (once) observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once, delay]);

  return [ref, isVisible];
};

export default useInView;
