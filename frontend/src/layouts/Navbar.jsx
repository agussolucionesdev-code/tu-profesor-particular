import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  FaBars,
  FaCalendarAlt,
  FaClipboardList,
  FaExclamationTriangle,
  FaMoon,
  FaSun,
  FaTimes,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { useUISettings } from "../components/accessibility/UISettingsContext";
import ThemeLogo from "../components/ui/ThemeLogo";
import {
  isVoiceMuted,
  primeVoicePlayback,
  setVoiceMuted,
} from "../utils/neuroToast";
import "./Navbar.css";

const VOICE_HINT_KEY = "voice_hint_seen";
const VOICE_MUTED_EVENT = "neuro-voice-muted-changed";
const VOICE_BLOCKED_EVENT = "neuro-voice-blocked";
const VOICE_READY_EVENT = "neuro-voice-ready";
const NAVBAR_VOICE_OPTIONS = {
  rate: 0.86,
  pitch: 0.98,
  volume: 0.9,
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [voiceMuted, setVoiceMutedState] = useState(() => isVoiceMuted());
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(() => {
    try {
      return window.localStorage.getItem(VOICE_HINT_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const themeTransitionTimerRef = useRef(null);
  const location = useLocation();
  const { effectiveTheme, setThemePreference } = useUISettings();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hint de voz: persiste hasta interacción explícita o 12 s, ya no
  // se descarta con el primer scroll (eso era confuso para el usuario).
  useEffect(() => {
    if (!showVoiceHint) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowVoiceHint(false);
      try {
        window.localStorage.setItem(VOICE_HINT_KEY, "true");
      } catch {
        // Ignore storage errors silently.
      }
    }, 30000);

    return () => window.clearTimeout(timeoutId);
  }, [showVoiceHint]);

  useEffect(
    () => () => {
      if (themeTransitionTimerRef.current) {
        window.clearTimeout(themeTransitionTimerRef.current);
      }
      document.documentElement.classList.remove("theme-transitioning");
    },
    [],
  );

  useEffect(() => {
    const syncVoiceState = (event) => {
      const nextMuted =
        typeof event.detail?.muted === "boolean"
          ? event.detail.muted
          : isVoiceMuted();
      setVoiceMutedState(nextMuted);
      if (nextMuted) setVoiceBlocked(false);
    };

    const handleBlocked = () => setVoiceBlocked(true);
    const handleReady = () => setVoiceBlocked(false);

    window.addEventListener(VOICE_MUTED_EVENT, syncVoiceState);
    window.addEventListener(VOICE_BLOCKED_EVENT, handleBlocked);
    window.addEventListener(VOICE_READY_EVENT, handleReady);
    return () => {
      window.removeEventListener(VOICE_MUTED_EVENT, syncVoiceState);
      window.removeEventListener(VOICE_BLOCKED_EVENT, handleBlocked);
      window.removeEventListener(VOICE_READY_EVENT, handleReady);
    };
  }, []);

  const dismissVoiceHint = () => {
    setShowVoiceHint(false);

    try {
      window.localStorage.setItem(VOICE_HINT_KEY, "true");
    } catch {
      // Ignore storage errors silently.
    }
  };

  const applyTheme = (nextTheme) => {
    document.documentElement.classList.add("theme-transitioning");

    if (themeTransitionTimerRef.current) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }

    setThemePreference(nextTheme);

    themeTransitionTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 420);
  };

  const toggleTheme = () => {
    const nextTheme = effectiveTheme === "dark" ? "light" : "dark";
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;

    if (
      !prefersReducedMotion &&
      typeof document.startViewTransition === "function"
    ) {
      document.startViewTransition(() => {
        flushSync(() => {
          applyTheme(nextTheme);
        });
      });
      return;
    }

    applyTheme(nextTheme);
  };

  const toggleVoice = () => {
    const nextMuted = !voiceMuted;
    setVoiceMuted(nextMuted);
    setVoiceMutedState(nextMuted);
    dismissVoiceHint();

    if (!nextMuted) {
      primeVoicePlayback({
        message:
          "Guía por voz activada. Te acompaño con mensajes suaves, claros y breves para que reserves o gestiones tu turno con tranquilidad.",
        voiceOptions: NAVBAR_VOICE_OPTIONS,
      });
      return;
    }

    window.speechSynthesis?.cancel?.();
  };

  const navLinks = [
    { title: "Reservar", path: "/reservar", icon: <FaCalendarAlt /> },
    { title: "Mis Turnos", path: "/portal", icon: <FaClipboardList /> },
  ];

  return (
    <nav className={`navbar-elite ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-aurora" aria-hidden="true" />
      <div className="navbar-container">
        <Link
          to="/reservar"
          className="navbar-brand"
          onClick={() => setIsOpen(false)}
          aria-label="Tu Profesor Particular — Agustín Elías Sosa"
        >
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-orbit" />
            <span className="brand-mark-glow" />
            <ThemeLogo variant="monogram" imgClassName="brand-mark-img" alt="" />
            <span className="brand-mark-sparkle brand-mark-sparkle--one" />
            <span className="brand-mark-sparkle brand-mark-sparkle--two" />
            <span className="brand-mark-sparkle brand-mark-sparkle--three" />
          </span>
          <span className="brand-copy">
            <span className="brand-title">
              Tu Profesor <span className="brand-title-accent">Particular</span>
            </span>
            <span className="brand-signature">Agustín Elías Sosa</span>
          </span>
        </Link>

        <div className="navbar-right-zone">
          <ul className={`nav-menu-list ${isOpen ? "active" : ""}`}>
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path === "/reservar" && location.pathname === "/");

              return (
                <li key={link.path} className="nav-item">
                  <Link
                    to={link.path}
                    className={`nav-link-btn ${isActive ? "active" : ""}`}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      {link.icon}
                    </span>
                    <span className="nav-text">{link.title}</span>
                    {isActive && (
                      <span className="nav-active-pulse" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            className="navbar-utility-cluster"
            aria-label="Preferencias visuales y de voz"
          >
            <div
              className={`voice-toggle-shell ${voiceMuted ? "muted" : "active"} ${voiceBlocked ? "blocked" : ""}`}
            >
              {showVoiceHint && voiceMuted && !voiceBlocked && (
                <button
                  type="button"
                  className="voice-hint-bubble"
                  onClick={toggleVoice}
                >
                  Activá la guía por voz
                </button>
              )}

              <button
                type="button"
                className={`nav-utility-btn voice-toggle-btn ${voiceMuted ? "muted" : "active"} ${voiceBlocked ? "blocked" : ""}`}
                onClick={toggleVoice}
                onBlur={dismissVoiceHint}
                title={
                  voiceBlocked
                    ? "El navegador bloqueó la voz. Habilitá el sonido para este sitio y reintentá."
                    : voiceMuted
                      ? "Activar guía por voz"
                      : "Pausar guía por voz"
                }
                aria-label={
                  voiceBlocked
                    ? "Guía por voz bloqueada por el navegador. Tocá para reintentar."
                    : voiceMuted
                      ? "Activar guía por voz"
                      : "Pausar guía por voz"
                }
                aria-pressed={!voiceMuted}
              >
                <span className="nav-utility-icon" aria-hidden="true">
                  {voiceBlocked ? (
                    <FaExclamationTriangle />
                  ) : voiceMuted ? (
                    <FaVolumeMute />
                  ) : (
                    <FaVolumeUp />
                  )}
                </span>
                <span className="nav-utility-copy">
                  <strong>Guía por voz</strong>
                  <small>
                    {voiceBlocked
                      ? "Habilitala en tu navegador"
                      : voiceMuted
                        ? "Tocá para activar"
                        : "Te acompaño al reservar"}
                  </small>
                </span>
                {!voiceMuted && !voiceBlocked && (
                  <span className="voice-wave" aria-hidden="true">
                    <span className="voice-wave-bar" />
                    <span className="voice-wave-bar" />
                    <span className="voice-wave-bar" />
                    <span className="voice-wave-bar" />
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              className="nav-utility-btn theme-toggle-btn"
              onClick={toggleTheme}
              title={
                effectiveTheme === "dark"
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"
              }
              aria-label={
                effectiveTheme === "dark"
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"
              }
            >
              <span className="nav-utility-icon theme-toggle-icon-wrap" aria-hidden="true">
                <FaSun className="theme-icon theme-icon--sun" />
                <FaMoon className="theme-icon theme-icon--moon" />
              </span>
              <span className="nav-utility-copy">
                <strong>
                  {effectiveTheme === "dark" ? "Modo claro" : "Modo oscuro"}
                </strong>
                <small>
                  {effectiveTheme === "dark" ? "Iluminar vista" : "Bajar brillo"}
                </small>
              </span>
            </button>
          </div>

          <button
            type="button"
            className="menu-toggle-icon"
            onClick={() => setIsOpen((currentState) => !currentState)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isOpen}
          >
            {isOpen ? <FaTimes aria-hidden="true" /> : <FaBars aria-hidden="true" />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
