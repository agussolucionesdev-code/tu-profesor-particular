import { useEffect, useRef, useState } from "react";
import {
  FaAdjust,
  FaCheck,
  FaEye,
  FaFont,
  FaMoon,
  FaPalette,
  FaSun,
  FaTimes,
  FaUniversalAccess,
  FaUndo,
} from "react-icons/fa";
import { useUISettings } from "./UISettingsContext";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./AccessibilityControls.css";

const themeOptions = [
  { value: "system", label: "Sistema", icon: FaAdjust },
  { value: "light", label: "Claro", icon: FaSun },
  { value: "dark", label: "Oscuro", icon: FaMoon },
];

const textOptions = [
  { value: "default", label: "Normal" },
  { value: "large", label: "Grande" },
  { value: "xlarge", label: "Muy grande" },
];

const accentOptions = [
  { value: "balanced", label: "Equilibrado" },
  { value: "navy", label: "Azul foco" },
  { value: "green", label: "Verde calma" },
];

const bookingPrimaryActionSelector = [
  ".form-slide-panel.active-panel:not([aria-hidden='true']) .field-flow-btn.field-flow-next",
  ".form-slide-panel.active-panel:not([aria-hidden='true']) .btn-date-next.is-ready",
  ".form-slide-panel.active-panel:not([aria-hidden='true']) .btn-time-next.is-ready",
  ".form-slide-panel.active-panel:not([aria-hidden='true']) .step-actions .btn-neuro-primary",
  ".form-slide-panel.active-panel:not([aria-hidden='true']) .step-actions .btn-neuro-success",
].join(", ");

const countActivePreferences = (preferences) =>
  [
    preferences.themePreference !== "light",
    preferences.fontScale !== "default",
    preferences.contrast !== "default",
    preferences.fontFamily !== "brand",
    preferences.motion !== "default",
    preferences.accentBalance !== "balanced",
    preferences.calmUi,
  ].filter(Boolean).length;

const AccessibilityControls = ({
  isAdminRoute = false,
  isBookingRoute = false,
}) => {
  const {
    preferences,
    updatePreference,
    setThemePreference,
    resetAccessibilityPreferences,
  } = useUISettings();
  const [isOpen, setIsOpen] = useState(false);
  const shellRef = useRef(null);
  const panelRef = useFocusTrap(isOpen);
  const activePreferences = countActivePreferences(preferences);
  const [footerLift, setFooterLift] = useState(0);
  const [bookingActionLift, setBookingActionLift] = useState(0);

  useEffect(() => {
    const updateFloatingControlOffsets = () => {
      const footer = window.document.querySelector(".footer-elite");
      const footerRect = footer?.getBoundingClientRect();
      const visibleFooterHeight = footerRect
        ? Math.max(0, window.innerHeight - footerRect.top)
        : 0;
      const maxLift = Math.max(0, window.innerHeight - 96);
      const nextLift =
        visibleFooterHeight > 0
          ? Math.min(visibleFooterHeight + 18, maxLift)
          : 0;

      setFooterLift(nextLift);

      if (!isBookingRoute || window.innerWidth > 720) {
        setBookingActionLift(0);
        return;
      }

      const bookingAction = window.document.querySelector(
        bookingPrimaryActionSelector,
      );
      const actionRect = bookingAction?.getBoundingClientRect();
      const actionIsNearViewportBottom =
        actionRect &&
        actionRect.top >= window.innerHeight - 220 &&
        actionRect.top < window.innerHeight;

      setBookingActionLift(
        actionIsNearViewportBottom
          ? Math.min(window.innerHeight - actionRect.top + 16, maxLift)
          : 0,
      );
    };

    const frameId = window.requestAnimationFrame(updateFloatingControlOffsets);
    const mainContent = window.document.getElementById("main-content");
    const layoutObserver =
      isBookingRoute && mainContent
        ? new MutationObserver(updateFloatingControlOffsets)
        : null;

    layoutObserver?.observe(mainContent, {
      attributes: true,
      attributeFilter: ["aria-hidden", "class"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("scroll", updateFloatingControlOffsets, { passive: true });
    window.addEventListener("resize", updateFloatingControlOffsets);

    return () => {
      window.cancelAnimationFrame(frameId);
      layoutObserver?.disconnect();
      window.removeEventListener("scroll", updateFloatingControlOffsets);
      window.removeEventListener("resize", updateFloatingControlOffsets);
    };
  }, [isBookingRoute]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!shellRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div
      className={`a11y-shell${isAdminRoute ? " is-admin-route" : ""}${isBookingRoute ? " is-booking-route" : ""}`}
      ref={shellRef}
      style={{
        "--a11y-footer-lift": `${footerLift}px`,
        "--a11y-booking-action-lift": `${bookingActionLift}px`,
      }}
    >
      {isOpen && (
        <section
          id="a11y-panel"
          className="a11y-panel"
          ref={panelRef}
          role="dialog"
          aria-labelledby="a11y-panel-title"
          aria-describedby="a11y-panel-copy"
        >
          <div className="a11y-panel-header">
            <div>
              <span className="a11y-panel-kicker">Accesibilidad</span>
              <h2 id="a11y-panel-title">Ajusta la lectura a tu forma</h2>
            </div>
            <button
              type="button"
              className="a11y-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar panel de accesibilidad"
            >
              <FaTimes />
            </button>
          </div>

          <p id="a11y-panel-copy" className="a11y-panel-copy">
            Los cambios se guardan en este dispositivo para que la experiencia
            siga siendo clara cada vez que vuelvas.
          </p>

          <div className="a11y-section">
            <div className="a11y-section-head">
              <FaEye />
              <span>Tema visual</span>
            </div>
            <div className="a11y-segmented-grid">
              {themeOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`a11y-chip ${preferences.themePreference === option.value ? "is-selected" : ""}`}
                    onClick={() => setThemePreference(option.value)}
                    aria-pressed={preferences.themePreference === option.value}
                  >
                    <Icon />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="a11y-section">
            <div className="a11y-section-head">
              <FaFont />
              <span>Tamaño de texto</span>
            </div>
            <div className="a11y-segmented-grid">
              {textOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`a11y-chip ${preferences.fontScale === option.value ? "is-selected" : ""}`}
                  onClick={() => updatePreference("fontScale", option.value)}
                  aria-pressed={preferences.fontScale === option.value}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="a11y-section">
            <div className="a11y-section-head">
              <FaPalette />
              <span>Balance de color</span>
            </div>
            <div className="a11y-segmented-grid">
              {accentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`a11y-chip ${preferences.accentBalance === option.value ? "is-selected" : ""}`}
                  onClick={() => updatePreference("accentBalance", option.value)}
                  aria-pressed={preferences.accentBalance === option.value}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="a11y-switch-list">
            <button
              type="button"
              className="a11y-switch-row"
              onClick={() =>
                updatePreference(
                  "contrast",
                  preferences.contrast === "high" ? "default" : "high",
                )
              }
              role="switch"
              aria-checked={preferences.contrast === "high"}
            >
              <div>
                <strong>Contraste reforzado</strong>
                <p>Oscurece textos y define mejor bordes y superficies.</p>
              </div>
              <span
                className={`a11y-switch-pill ${preferences.contrast === "high" ? "is-on" : ""}`}
                aria-hidden="true"
              >
                {preferences.contrast === "high" && <FaCheck />}
              </span>
            </button>

            <button
              type="button"
              className="a11y-switch-row"
              onClick={() =>
                updatePreference(
                  "fontFamily",
                  preferences.fontFamily === "readable" ? "brand" : "readable",
                )
              }
              role="switch"
              aria-checked={preferences.fontFamily === "readable"}
            >
              <div>
                <strong>Tipografía de lectura facilitada</strong>
                <p>Hace más claras las formas y aumenta la respiración visual.</p>
              </div>
              <span
                className={`a11y-switch-pill ${preferences.fontFamily === "readable" ? "is-on" : ""}`}
                aria-hidden="true"
              >
                {preferences.fontFamily === "readable" && <FaCheck />}
              </span>
            </button>

            <button
              type="button"
              className="a11y-switch-row"
              onClick={() =>
                updatePreference(
                  "motion",
                  preferences.motion === "reduced" ? "default" : "reduced",
                )
              }
              role="switch"
              aria-checked={preferences.motion === "reduced"}
            >
              <div>
                <strong>Reducir movimiento</strong>
                <p>Disminuye transiciones y animaciones para una navegación serena.</p>
              </div>
              <span
                className={`a11y-switch-pill ${preferences.motion === "reduced" ? "is-on" : ""}`}
                aria-hidden="true"
              >
                {preferences.motion === "reduced" && <FaCheck />}
              </span>
            </button>

            <button
              type="button"
              className="a11y-switch-row"
              onClick={() => updatePreference("calmUi", !preferences.calmUi)}
              role="switch"
              aria-checked={preferences.calmUi}
            >
              <div>
                <strong>Atenuar fondos decorativos</strong>
                <p>Reduce los brillos para que el contenido sea el protagonista.</p>
              </div>
              <span
                className={`a11y-switch-pill ${preferences.calmUi ? "is-on" : ""}`}
                aria-hidden="true"
              >
                {preferences.calmUi && <FaCheck />}
              </span>
            </button>
          </div>

          <div className="a11y-panel-footer">
            <span className="a11y-summary">
              {activePreferences > 0
                ? `${activePreferences} ajustes activos`
                : "Sin ajustes extra"}
            </span>
            <button
              type="button"
              className="a11y-reset-btn"
              onClick={resetAccessibilityPreferences}
            >
              <FaUndo />
              Restablecer
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`a11y-fab ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((currentState) => !currentState)}
        aria-expanded={isOpen}
        aria-controls="a11y-panel"
        aria-label={
          isOpen ? "Cerrar accesibilidad" : "Abrir panel de accesibilidad"
        }
        aria-haspopup="dialog"
      >
        <FaUniversalAccess />
        <span>Accesibilidad</span>
        {activePreferences > 0 && (
          <span className="a11y-fab-badge">{activePreferences}</span>
        )}
      </button>
    </div>
  );
};

export default AccessibilityControls;
