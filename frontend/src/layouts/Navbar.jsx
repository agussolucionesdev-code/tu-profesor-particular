import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  FaArrowRight,
  FaBars,
  FaCalendarAlt,
  FaClipboardList,
  FaExclamationTriangle,
  FaHome,
  FaMoon,
  FaSun,
  FaTimes,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { useUISettings } from "../components/accessibility/UISettingsContext";
import Magnetic from "../components/ui/Magnetic";
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
  const [scrollProgress, setScrollProgress] = useState(0);
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
  const rafRef = useRef(0);
  const location = useLocation();
  const { effectiveTheme, setThemePreference } = useUISettings();

  // Scroll: estado compacto + barra de progreso de lectura (rAF-throttled).
  useEffect(() => {
    const measure = () => {
      rafRef.current = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 16);
      setScrollProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };

    const handleScroll = () => {
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(measure);
      }
    };

    measure();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Menú mobile: bloquea el scroll del body y cierra con Escape.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  // Hint de voz: persiste hasta interacción explícita o 30 s.
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
    { title: "Inicio", path: "/", icon: <FaHome /> },
    { title: "Mis Turnos", path: "/portal", icon: <FaClipboardList /> },
  ];

  const voiceTitle = voiceBlocked
    ? "El navegador bloqueó la voz. Habilitá el sonido para este sitio y reintentá."
    : voiceMuted
      ? "Activar guía por voz"
      : "Pausar guía por voz";

  return (
    <nav className={`navbar-elite ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-container">
        <Link
          to="/"
          className="navbar-brand"
          onClick={() => setIsOpen(false)}
          aria-label="Tu Profesor Particular — Agustín Elías Sosa"
        >
          <span className="brand-mark" aria-hidden="true">
            <ThemeLogo variant="monogram" imgClassName="brand-mark-img" alt="" />
          </span>
          <span className="brand-copy">
            <span className="brand-title">
              Tu Profesor <span className="brand-title-accent">Particular</span>
            </span>
            <span className="brand-signature">Agustín Elías Sosa</span>
          </span>
        </Link>

        <div className="navbar-right-zone">
          {/* Backdrop del menú mobile */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`nav-sheet-backdrop ${isOpen ? "active" : ""}`}
            onClick={() => setIsOpen(false)}
          />

          <ul
            id="nav-menu-sheet"
            className={`nav-menu-list ${isOpen ? "active" : ""}`}
          >
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;

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
                  </Link>
                </li>
              );
            })}

            {/* CTA principal: reservar. Destacado, no un link más. */}
            <li className="nav-item nav-item-cta">
              <Magnetic strength={0.4} className="nav-cta-magnetic">
                <Link
                  to="/reservar"
                  className={`nav-cta-btn ${location.pathname === "/reservar" ? "active" : ""}`}
                  onClick={() => setIsOpen(false)}
                  aria-current={
                    location.pathname === "/reservar" ? "page" : undefined
                  }
                >
                  <FaCalendarAlt aria-hidden="true" />
                  <span>Reservar</span>
                  <FaArrowRight className="nav-cta-arrow" aria-hidden="true" />
                </Link>
              </Magnetic>
            </li>
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
                title={voiceTitle}
                aria-label={voiceTitle}
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
                {!voiceMuted && !voiceBlocked && (
                  <span className="voice-wave" aria-hidden="true">
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
              <span
                className="nav-utility-icon theme-toggle-icon-wrap"
                aria-hidden="true"
              >
                <FaSun className="theme-icon theme-icon--sun" />
                <FaMoon className="theme-icon theme-icon--moon" />
              </span>
            </button>
          </div>

          <button
            type="button"
            className="menu-toggle-icon"
            onClick={() => setIsOpen((currentState) => !currentState)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isOpen}
            aria-controls="nav-menu-sheet"
          >
            {isOpen ? <FaTimes aria-hidden="true" /> : <FaBars aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Progreso de lectura: hairline verde que crece con el scroll */}
      <span
        className="navbar-progress"
        aria-hidden="true"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />
    </nav>
  );
};

export default Navbar;
