import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  LuAudioLines,
  LuCalendarCheck,
  LuCalendarPlus,
  LuHouse,
  LuMenu,
  LuMoon,
  LuSun,
  LuTriangleAlert,
  LuVolumeOff,
  LuX,
} from "react-icons/lu";
import { useUISettings } from "../components/accessibility/UISettingsContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import ThemeLogo from "../components/ui/ThemeLogo";
import {
  isVoiceMuted,
  primeVoicePlayback,
  setVoiceMuted,
} from "../utils/neuroToast";
import "./Navbar.css";

/* LA BARRA DE NAVEGACIÓN: UNA ISLA DE VIDRIO.
 *
 * Tercera versión, pedida por Agustín: «súper profesional», con el logo
 * grande —«tiene que imponer, es el logo de Tu Profesor Particular»— y con
 * vidrio, algo de 2026. Las reglas que se mantienen de la anterior:
 *
 *   · nada se desplaza: al pasar el mouse, al hacer scroll y al elegir
 *     cambian color, sombra o fondo, nunca posición ni tamaño;
 *   · colores sólo de la capa semántica, así que es la misma pieza en claro
 *     y en oscuro;
 *   · el desenfoque del vidrio va en un ::before, no en la barra: un
 *     ancestro con backdrop-filter se vuelve el bloque contenedor de sus
 *     hijos fixed y recortaba el menú del teléfono (menu-mobile.spec.js).
 *
 * Íconos de Lucide, todos del mismo trazo. El logo es el monograma TU con
 * el birrete, grande: ~64 px de trazo en escritorio, ~58 en tableta y ~50 en
 * el teléfono (ver Navbar.css). */

const VOICE_MUTED_EVENT = "neuro-voice-muted-changed";
const VOICE_BLOCKED_EVENT = "neuro-voice-blocked";
const VOICE_READY_EVENT = "neuro-voice-ready";
const NAVBAR_VOICE_OPTIONS = {
  rate: 0.86,
  pitch: 0.98,
  volume: 0.9,
};

/* ── Descubrimiento de la guía por voz ─────────────────────────────────────
   Se anuncia en tres capas, de menor a mayor intrusión: rótulo visible en el
   botón, un punto mientras nunca se haya usado, y una invitación a los 4 s que
   se puede aceptar o posponer. Si la posponen vuelve cada 3 minutos, COMO
   MÁXIMO 3 veces. Si la activan o la descartan, no molesta nunca más. */
const VOICE_INVITE_KEY = "voice_invite_state_v2";
const VOICE_INVITE_MAX = 3;
const VOICE_INVITE_FIRST_DELAY = 4000;
const VOICE_INVITE_REPEAT_DELAY = 180000;
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
    // Almacenamiento bloqueado: la invitación sólo deja de recordarse.
  }
};

const navLinks = [
  { title: "Inicio", path: "/", icon: LuHouse },
  { title: "Mis Turnos", path: "/portal", icon: LuCalendarCheck },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useFocusTrap(isOpen);
  const [scrolled, setScrolled] = useState(false);
  const [voiceMuted, setVoiceMutedState] = useState(() => isVoiceMuted());
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [showVoiceInvite, setShowVoiceInvite] = useState(false);
  const [inviteDone, setInviteDone] = useState(() => readInviteState().done);
  const inviteShownRef = useRef(readInviteState().shown);
  const themeTransitionTimerRef = useRef(null);
  const location = useLocation();
  const { effectiveTheme, setThemePreference } = useUISettings();

  /* Sólo un booleano: la línea inferior aparece al despegarse del borde. El
     estado cambia una vez por cruce del umbral, no en cada píxel de scroll. */
  useEffect(() => {
    const medir = () => setScrolled(window.scrollY > 8);
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);

  // Menú del teléfono: bloquea el scroll del cuerpo y cierra con Escape.
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

  useEffect(() => {
    if (inviteDone || !voiceMuted || voiceBlocked) return undefined;

    const hideTimers = [];
    const offer = () => {
      if (inviteShownRef.current >= VOICE_INVITE_MAX) return;
      setShowVoiceInvite(true);
      inviteShownRef.current += 1;
      writeInviteState({ done: false, shown: inviteShownRef.current });
      hideTimers.push(
        window.setTimeout(() => setShowVoiceInvite(false), VOICE_INVITE_VISIBLE_MS),
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
        typeof event.detail?.muted === "boolean" ? event.detail.muted : isVoiceMuted();
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
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (!prefersReducedMotion && typeof document.startViewTransition === "function") {
      document.startViewTransition(() => {
        flushSync(() => applyTheme(nextTheme));
      });
      return;
    }
    applyTheme(nextTheme);
  };

  const toggleVoice = () => {
    const nextMuted = !voiceMuted;
    setVoiceMuted(nextMuted);
    setVoiceMutedState(nextMuted);
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

  const voiceTitle = voiceBlocked
    ? "El navegador bloqueó la voz. Habilitá el sonido para este sitio y reintentá."
    : voiceMuted
      ? "Activar guía por voz: te acompaño hablado en cada paso"
      : "Pausar guía por voz";
  const voiceLabel = voiceBlocked ? "Voz bloqueada" : voiceMuted ? "Guía por voz" : "Guía activa";
  const VoiceIcon = voiceBlocked ? LuTriangleAlert : voiceMuted ? LuVolumeOff : LuAudioLines;
  const voiceIsUndiscovered = voiceMuted && !voiceBlocked && !inviteDone;
  const themeTitle = effectiveTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  const ThemeIcon = effectiveTheme === "dark" ? LuSun : LuMoon;
  const enReservar = location.pathname === "/reservar";

  /* Los dos utilitarios se pintan en dos lugares: en la barra (escritorio) y
     al pie del menú (teléfono). Cada copia se oculta con display:none en el
     tamaño que no le toca, así que nunca hay dos visibles ni dos en el árbol
     de accesibilidad a la vez. */
  const botonVoz = (lugar) => (
    <button
      type="button"
      className={`tpp-nav-tool tpp-nav-voice tpp-nav-tool--${lugar}`}
      data-estado={voiceBlocked ? "bloqueada" : voiceMuted ? "apagada" : "activa"}
      onClick={toggleVoice}
      title={voiceTitle}
      aria-label={voiceTitle}
      aria-pressed={!voiceMuted}
    >
      <VoiceIcon aria-hidden="true" />
      <span className="tpp-nav-tool-label">{voiceLabel}</span>
      {voiceIsUndiscovered && <span className="tpp-nav-voice-dot" aria-hidden="true" />}
    </button>
  );

  const botonTema = (lugar) => (
    <button
      type="button"
      className={`tpp-nav-tool tpp-nav-theme tpp-nav-tool--${lugar}`}
      onClick={toggleTheme}
      title={themeTitle}
      aria-label={themeTitle}
    >
      <ThemeIcon aria-hidden="true" />
      <span className="tpp-nav-tool-label">
        {effectiveTheme === "dark" ? "Modo claro" : "Modo oscuro"}
      </span>
    </button>
  );

  return (
    <nav
      className="tpp-nav"
      data-scrolled={scrolled ? "true" : "false"}
      aria-label="Navegación principal"
    >
      {/* La isla: el vidrio es su ::before. */}
      <div className="tpp-nav-inner">
        <Link
          to="/"
          className="navbar-brand"
          aria-label="Tu Profesor Particular, inicio"
        >
          <ThemeLogo variant="monogram" imgClassName="tpp-nav-mark" sizes="100px" alt="" aria-hidden="true" />
          <span className="tpp-nav-brand-copy">
            <span className="tpp-nav-brand-title">
              Tu Profesor <em>Particular</em>
            </span>
            <span className="tpp-nav-brand-sub">Agustín Elías Sosa</span>
          </span>
        </Link>

        {/* El fondo del menú del teléfono. No es un control: el menú se cierra
            con su botón o con Escape; esto es sólo para el toque afuera. */}
        <div
          className="tpp-nav-backdrop"
          data-open={isOpen ? "true" : "false"}
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />

        {/* En escritorio esta lista son los enlaces en línea de la barra y
            `isOpen` nunca se enciende: el botón de menú no existe ahí, y el
            hook del foco no hace nada. En el teléfono es el panel desplegable. */}
        <ul
          id="nav-menu-sheet"
          ref={sheetRef}
          className="tpp-nav-links"
          data-open={isOpen ? "true" : "false"}
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            const Icono = link.icon;
            return (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className="tpp-nav-link"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                >
                  <Icono aria-hidden="true" />
                  <span>{link.title}</span>
                </Link>
              </li>
            );
          })}
          <li className="tpp-nav-sheet-tools">
            {botonVoz("menu")}
            {botonTema("menu")}
          </li>
        </ul>

        <div className="tpp-nav-actions">
          {botonVoz("barra")}
          {botonTema("barra")}

          <Link
            to="/reservar"
            className="tpp-nav-cta"
            aria-current={enReservar ? "page" : undefined}
          >
            <LuCalendarPlus aria-hidden="true" />
            <span className="tpp-nav-cta-texto">Reservar</span>
          </Link>

          <button
            type="button"
            className="tpp-nav-menu"
            onClick={() => setIsOpen((abierto) => !abierto)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isOpen}
            aria-controls="nav-menu-sheet"
          >
            {isOpen ? <LuX aria-hidden="true" /> : <LuMenu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {showVoiceInvite && voiceMuted && !voiceBlocked && (
        <div className="tpp-nav-invite" role="status">
          <p className="tpp-nav-invite-copy">
            <strong>¿Querés que te guíe hablando?</strong>
            Te acompaño paso a paso mientras reservás tu turno.
          </p>
          <div className="tpp-nav-invite-actions">
            <button type="button" className="tpp-nav-invite-yes" onClick={toggleVoice}>
              Activar guía
            </button>
            <button
              type="button"
              className="tpp-nav-invite-no"
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
