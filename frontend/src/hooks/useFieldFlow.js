import { useRef, useEffect, useCallback, useState } from "react";

/**
 * Hace scroll al elemento con un offset calculado considerando navbar,
 * stepper y compass. Respeta prefers-reduced-motion.
 *
 * @param {HTMLElement} el - Elemento DOM al que hacer scroll
 */
const scrollToActive = (el) => {
  if (!el) return;
  const formCardEl = el.closest(".form-card-elevation");
  const journeyCompassEl = formCardEl?.querySelector(".journey-compass");
  const stepperEl = formCardEl?.querySelector(".neuro-stepper");
  const sectionTitleEl = el.closest(".form-section-block")?.querySelector(
    ".section-title",
  );
  const progressBarEl = el.closest(".field-flow-stage")?.querySelector(
    ".field-flow-progress",
  );
  const anchorEl =
    journeyCompassEl || stepperEl || sectionTitleEl || progressBarEl || el;
  const navH =
    document.querySelector(".navbar-elite")?.getBoundingClientRect().height ??
    72;
  const anchorSpacing = anchorEl === el ? 112 : 16;
  const totalOffset = navH + anchorSpacing;
  const initialTop =
    anchorEl.getBoundingClientRect().top + window.scrollY - totalOffset;
  const prefersReduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  window.scrollTo({
    top: Math.max(0, initialTop),
    behavior: prefersReduced ? "auto" : "smooth",
  });

  window.setTimeout(() => {
    const blockRect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const bottomSafeArea = Math.max(88, Math.round(viewportHeight * 0.14));
    const topSafeArea = navH + 16;
    let adjustedTop = null;

    if (blockRect.bottom > viewportHeight - bottomSafeArea) {
      adjustedTop =
        window.scrollY +
        (blockRect.bottom - (viewportHeight - bottomSafeArea));
    }

    if (blockRect.top < topSafeArea) {
      adjustedTop =
        window.scrollY -
        (topSafeArea - blockRect.top);
    }

    if (adjustedTop !== null) {
      window.scrollTo({
        top: Math.max(0, adjustedTop),
        behavior: prefersReduced ? "auto" : "smooth",
      });
    }
  }, prefersReduced ? 0 : 220);
};

/**
 * @module useFieldFlow
 * @description Hook para gestionar el flujo de campos uno a la vez.
 * Centraliza la lógica que estaba duplicada en useFieldFlow (PersonalInfoStep)
 * y useAcademicFlow (AcademicInfoStep).
 *
 * @param {Object} params
 * @param {Array<{key: string}>} params.fields - Campos en orden de aparición
 * @param {*} params.resetTrigger - Valor que al cambiar resetea el índice (ej: isAdult)
 * @param {boolean} [params.startVisible=true] - Si false, espera a que resetTrigger
 *   sea truthy para ejecutar el reset con scroll (útil para secciones que se montan
 *   antes de estar visibles)
 *
 * @returns {{
 *   activeIndex: number,
 *   showVerification: boolean,
 *   fieldRefs: React.MutableRefObject<Object>,
 *   goNext: () => void,
 *   jumpTo: (index: number) => void,
 *   enterVerification: () => void,
 *   exitVerification: (index: number) => void,
 * }}
 *
 * @example
 * const { activeIndex, showVerification, fieldRefs, goNext, jumpTo, enterVerification, exitVerification } =
 *   useFieldFlow({ fields, resetTrigger: isAdult });
 */
const useFieldFlow = ({ fields, resetTrigger, startVisible = true }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const fieldRefs = useRef({});

  /**
   * Hace scroll al campo en el índice dado y pone foco en su primer
   * elemento interactivo después de 90ms (para que el scroll termine).
   *
   * @param {number} index
   */
  const scrollToField = useCallback(
    (index) => {
      const key = fields[index]?.key;
      if (!key) return;
      const el = fieldRefs.current[key];
      if (!el) return;
      scrollToActive(el);
      setTimeout(() => {
        el
          .querySelector(
            "input, select, textarea, button[role='switch']",
          )
          ?.focus?.({ preventScroll: true });
      }, 90);
    },
    [fields],
  );

  /**
   * Avanza al siguiente campo. Si ya no hay más campos, activa
   * la pantalla de verificación en lugar de sobrepasar el límite.
   */
  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev >= fields.length - 1) {
        // Último campo: ir a verificación
        setTimeout(() => setShowVerification(true), 0);
        return prev;
      }
      const next = prev + 1;
      setTimeout(() => scrollToField(next), 80);
      return next;
    });
  }, [fields.length, scrollToField]);

  /**
   * Va directo a un campo específico (usado para editar desde verificación).
   *
   * @param {number} index - Índice 0-based del campo destino
   */
  const jumpTo = useCallback(
    (index) => {
      setActiveIndex(index);
      setTimeout(() => scrollToField(index), 80);
    },
    [scrollToField],
  );

  /**
   * Activa la pantalla de verificación de datos.
   */
  const enterVerification = useCallback(() => {
    setShowVerification(true);
  }, []);

  /**
   * Desactiva la pantalla de verificación y navega al campo indicado.
   *
   * @param {number} index - Índice del campo a editar
   */
  const exitVerification = useCallback(
    (index) => {
      setShowVerification(false);
      setActiveIndex(index);
      setTimeout(() => scrollToField(index), 120);
    },
    [scrollToField],
  );

  // Reset cuando cambia resetTrigger.
  // Si startVisible=false, solo ejecuta cuando el trigger se vuelve truthy.
  useEffect(() => {
    if (!startVisible && !resetTrigger) return;
    setActiveIndex(0);
    setShowVerification(false);
    setTimeout(() => scrollToField(0), 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTrigger]);

  return {
    activeIndex,
    showVerification,
    fieldRefs,
    goNext,
    jumpTo,
    enterVerification,
    exitVerification,
  };
};

export default useFieldFlow;
