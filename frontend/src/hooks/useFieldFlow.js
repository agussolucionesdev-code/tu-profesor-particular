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

  /* ── Zona segura: tercio superior del viewport visible ── */
  const safeTop = navH + 16;

  /* Posicionar el TOP del campo al 28% del viewport (tercio superior).
     Esto garantiza que: la progress bar quede visible arriba, el campo
     esté alto y centrado, y el footer NUNCA aparezca abajo. */
  const targetViewportY = window.innerHeight * 0.28;
  const elRect = el.getBoundingClientRect();
  const targetScrollY = window.scrollY + (elRect.top - Math.max(safeTop, targetViewportY));

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
  const setFieldRef = useCallback((fieldKey, element) => {
    fieldRefs.current[fieldKey] = element;
  }, []);

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
  //
  // Dos modos de operación:
  //
  // startVisible=true (PersonalInfoStep, resetTrigger=isAdult):
  //   - La sección siempre está visible.
  //   - Primer render: inicializar y scrollear al campo 0.
  //   - Cambios posteriores (toggle isAdult): mantener índice, solo limpiar verificación.
  //
  // startVisible=false (AcademicInfoStep, resetTrigger=isVisible):
  //   - La sección empieza oculta.
  //   - Mientras esté oculta (trigger falsy): ignorar y marcar como no-vista.
  //   - Primer vez visible (false → true): inicializar + scroll (como si fuera mount inicial).
  //   - Si vuelve a ocultarse y reaparece: reinicializar + scroll también.
  //   - No hay cambios de trigger mientras está visible (no aplica isAdult aquí).
  const prevTrigger = useRef(resetTrigger);
  // Tracks si la sección ya fue inicializada al menos una vez estando visible.
  // Se resetea a false cuando la sección se oculta, para reinicializar al reaparecer.
  const sectionEverVisible = useRef(startVisible);

  useEffect(() => {
    if (!startVisible && !resetTrigger) {
      // Sección oculta: resetear bandera para que la próxima aparición reinicialice.
      sectionEverVisible.current = false;
      return;
    }

    const isFirstAppearance = !sectionEverVisible.current;
    // Para startVisible=true: detectar el primer render (trigger no ha cambiado aún).
    const isInitialMount = prevTrigger.current === resetTrigger;

    prevTrigger.current = resetTrigger;

    if (isFirstAppearance || isInitialMount) {
      // Primera vez visible (o primer render): ir al campo 0 y scrollear.
      sectionEverVisible.current = true;
      setActiveIndex(0);
      setShowVerification(false);
      setTimeout(() => scrollToField(0), 120);
    } else {
      // Cambio posterior mientras ya está visible (ej: toggle adultMode):
      // limpiar verificación pero mantener el índice actual para no rebobinar.
      setShowVerification(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTrigger]);

  return {
    activeIndex,
    showVerification,
    fieldRefs,
    setFieldRef,
    goNext,
    jumpTo,
    enterVerification,
    exitVerification,
  };
};

export default useFieldFlow;
