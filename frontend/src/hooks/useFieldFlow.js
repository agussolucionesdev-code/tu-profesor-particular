import { useRef, useEffect, useCallback, useState } from "react";

/**
 * Centra el campo activo en la zona segura del viewport (entre navbar y
 * el 88 % inferior). Garantiza que la barra de progreso quede visible
 * arriba y que el footer nunca se vea. Respeta prefers-reduced-motion.
 *
 * @param {HTMLElement} el - Elemento DOM del field-block activo
 */
const scrollToActive = (el) => {
  if (!el) return;

  const navH =
    document.querySelector(".navbar-elite")?.getBoundingClientRect().height ??
    72;

  /* ── Zona segura: desde debajo de la navbar hasta el 88 % del viewport ── */
  const safeTop = navH + 16;
  const safeBottom = window.innerHeight * 0.88;
  const safeCenterY = (safeTop + safeBottom) / 2;

  /* ── Centro actual del campo en el viewport ── */
  const elRect = el.getBoundingClientRect();
  const elCenterY = (elRect.top + elRect.bottom) / 2;

  /* ── Scroll para centrar el campo en la zona segura ── */
  const targetScrollY = window.scrollY + (elCenterY - safeCenterY);

  /* ── Asegurar que la progress bar / section title no queden cortados ── */
  const stageEl = el.closest(".field-flow-stage");
  const anchorEl =
    stageEl?.querySelector(".field-flow-progress") ||
    el.closest(".progressive-inner")?.querySelector(".section-title") ||
    el;
  const anchorTop =
    anchorEl.getBoundingClientRect().top + window.scrollY - safeTop;
  const finalTop = Math.min(targetScrollY, anchorTop);

  const prefersReduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  window.scrollTo({
    top: Math.max(0, finalTop),
    behavior: prefersReduced ? "auto" : "smooth",
  });
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
