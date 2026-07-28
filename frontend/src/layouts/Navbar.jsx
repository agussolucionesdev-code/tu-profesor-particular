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

const VOICE_MUTED_EVENT = "neuro-voice-muted-changed";
const VOICE_BLOCKED_EVENT = "neuro-voice-blocked";
const VOICE_READY_EVENT = "neuro-voice-ready";
const NAVBAR_VOICE_OPTIONS = {
  rate: 0.86,
  pitch: 0.98,
  volume: 0.9,
};

/* ── Descubrimiento de la guía por voz ─────────────────────────────────────
   La guía por voz es una función valiosa que antes vivía detrás de un ícono
   mudo: nadie sabía que existía. Ahora se anuncia en tres capas, de menor a
   mayor intrusión:
     1. El control lleva rótulo visible ("Guía por voz"), no sólo un ícono.
     2. Un punto pulsante mientras nunca se haya usado.
     3. Una invitación que aparece a los 4 s y se puede aceptar o posponer.
   Si la posponen, vuelve a ofrecerse cada 3 minutos, COMO MÁXIMO 3 veces en
   total. Si la activan o la descartan, no molesta nunca más (se recuerda entre
   visitas). El objetivo es que se entere, no perseguirla. */
const VOICE_INVITE_KEY = "voice_invite_state_v2";
const VOICE_INVITE_MAX = 3;
const VOICE_INVITE_FIRST_DELAY = 4000;
const VOICE_INVITE_REPEAT_DELAY = 180000; // 3 min
const VOICE_INVITE_VISIBLE_MS = 15000;

const readInviteState = () => {
  try {
    const raw = window.localStorage.getItem(VOICE_INVITE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      done: Boolean(parsed?.done),
      shown: Number(parsed?.shown) || 0,
    };
  } catch {
    return { done: false, shown: 0 };
  }
};

const writeInviteState = (state) => {
  try {
    window.localStorage.setItem(VOICE_INVITE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors silently.
  }
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [voiceMuted, setVoiceMutedState] = useState(() => isVoiceMuted());
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [showVoiceInvite, setShowVoiceInvite] = useState(false);
  /* `inviteDone` = ya la activó o la descartó; no se vuelve a ofrecer nunca.
     Es estado (no ref) porque decide si se pinta el punto pulsante.
     El contador de apariciones sí va en un ref: no afecta al render. */
  const [inviteDone, setInviteDone] = useState(() => readInviteState().done);
  const inviteShownRef = useRef(readInviteState().shown);
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

  /* Ciclo de invitación a la guía por voz: primer ofrecimiento a los 4 s y
     recordatorios cada 3 min, hasta 3 en total. Cada aparición dura 15 s. Se
     detiene apenas la voz se activa o el visitante la descarta. */
  useEffect(() => {
    if (inviteDone || !voiceMuted || voiceBlocked) return undefined;

    const hideTimers = [];
    const offer = () => {
      if (inviteShownRef.current >= VOICE_INVITE_MAX) return;
      setShowVoiceInvite(true);
      inviteShownRef.current += 1;
      writeInviteState({ done: false, shown: inviteShownRef.current });
      hideTimers.push(
        window.setTimeout(
          () => setShowVoiceInvite(false),
          VOICE_INVITE_VISIBLE_MS,
        ),
      );
    };

    const first = window.setTimeout(offer, VOICE_INVITE_FIRST_DELAY);
    const repeat = window.setInterval(offer, VOICE_INVITE_REPEAT_DELAY);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(repeat);
      hideTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [voiceMuted, voiceBlocked, inviteDone]);

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

  /* Cierra la invitación. `forever` la da por saldada: no se vuelve a ofrecer
     en visitas futuras (se usa al activar la voz o al elegir "Ahora no"). */
  const closeVoiceInvite = (forever = false) => {
    setShowVoiceInvite(false);
    if (forever) {
      setInviteDone(true);
      writeInviteState({ done: true, shown: inviteShownRef.current });
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
    // Ya conoce la función: se deja de ofrecer.
    closeVoiceInvite(true);

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
      ? "Activar guía por voz: te acompaño hablado en cada paso"
      : "Pausar guía por voz";

  // Punto pulsante mientras la función siga sin descubrirse.
  const voiceIsUndiscovered = voiceMuted && !voiceBlocked && !inviteDone;

  return (
    <nav className={`navbar-elite ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-container">
        <Link
          to="/"
          className="navbar-brand"
          onClick={() => setIsOpen(false)}
          aria-label="Tu Profesor Particular — Agustín Elías Sosa"
        >
          {/* Monograma sin caja ni borde: antes se leía como sticker pegado. */}
          <ThemeLogo
            variant="monogram"
            imgClassName="brand-mark-img"
            alt=""
            aria-hidden="true"
          />
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
              <button
                type="button"
                className={`voice-toggle-btn ${voiceMuted ? "muted" : "active"} ${voiceBlocked ? "blocked" : ""}`}
                onClick={toggleVoice}
                title={voiceTitle}
                aria-label={voiceTitle}
                aria-pressed={!voiceMuted}
              >
                <span className="voice-toggle-icon" aria-hidden="true">
                  {voiceBlocked ? (
                    <FaExclamationTriangle />
                  ) : voiceMuted ? (
                    <FaVolumeMute />
                  ) : (
                    <FaVolumeUp />
                  )}
                </span>
                {/* Rótulo visible: la función se entiende sin tocar nada. */}
                <span className="voice-toggle-label">
                  {voiceBlocked
                    ? "Voz bloqueada"
                    : voiceMuted
                      ? "Guía por voz"
                      : "Guía activa"}
                </span>
                {!voiceMuted && !voiceBlocked && (
                  <span className="voice-wave" aria-hidden="true">
                    <span className="voice-wave-bar" />
                    <span className="voice-wave-bar" />
                    <span className="voice-wave-bar" />
                  </span>
                )}
                {voiceIsUndiscovered && (
                  <span className="voice-new-dot" aria-hidden="true" />
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

        {/* Progreso de lectura: hairline verde al pie de la cápsula. Va dentro
            para que el overflow:hidden lo recorte siguiendo el border-radius. */}
        <span
          className="navbar-progress"
          aria-hidden="true"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      {/* Invitación a la guía por voz. Vive FUERA de la cápsula: el
          backdrop-filter de ésta la vuelve contenedor de sus hijos fixed y su
          overflow:hidden recortaría la tarjeta. */}
      {showVoiceInvite && voiceMuted && !voiceBlocked && (
        <div className="voice-invite" role="status">
          <p className="voice-invite-copy">
            <strong>¿Querés que te guíe hablando?</strong>
            Te acompaño paso a paso mientras reservás tu turno.
          </p>
          <div className="voice-invite-actions">
            <button
              type="button"
              className="voice-invite-yes"
              onClick={toggleVoice}
            >
              Activar guía
            </button>
            <button
              type="button"
              className="voice-invite-no"
              onClick={() => closeVoiceInvite(true)}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
