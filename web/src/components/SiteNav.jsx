import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LuArrowUpRight,
  LuBookOpen,
  LuCalendarPlus,
  LuHouse,
  LuMenu,
  LuMessageCircle,
  LuMoon,
  LuRoute,
  LuSun,
  LuUserRound,
  LuX,
} from "react-icons/lu";
import { BOOKING_RESERVE_URL, BRAND } from "../data/site.js";
import { useTema } from "../hooks/useTema.js";
import "./SiteNav.css";

/* ══════════════════════════════════════════════════════
   LA BARRA: UNA ISLA DE VIDRIO

   Mismo lenguaje que la barra de la app de turnos, para que las dos se sientan
   un producto: isla flotante de vidrio esmerilado, monograma grande, íconos
   Lucide del mismo trazo y el mismo botón de tema.

   El vidrio va en el ::before de la cápsula y no en la cápsula: un elemento
   con backdrop-filter se vuelve el contenedor de sus hijos `position: fixed`,
   y el menú del celular quedaba recortado por la barra.
══════════════════════════════════════════════════════ */

const LINKS = [
  { to: "/", label: "Inicio", icon: LuHouse },
  { to: "/sobre-mi", label: "Sobre mí", icon: LuUserRound },
  { to: "/materias", label: "Materias", icon: LuBookOpen },
  { to: "/como-trabajo", label: "Cómo trabajo", icon: LuRoute },
  { to: "/contacto", label: "Contacto", icon: LuMessageCircle },
];

/* Los dos íconos se dibujan siempre y el CSS muestra el que corresponde según
   `data-theme`: así el HTML prerenderizado ya sale con el ícono correcto, sin
   esperar a que React lea el tema. */
const BotonTema = ({ variante, oscuro, alternar }) => (
  <button
    type="button"
    className={`snav-tema snav-tema--${variante}`}
    onClick={alternar}
    aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
  >
    <LuMoon className="snav-tema-luna" aria-hidden="true" />
    <LuSun className="snav-tema-sol" aria-hidden="true" />
    {variante === "menu" && (
      <span className="snav-tema-texto" aria-hidden="true">
        {oscuro ? "Modo claro" : "Modo oscuro"}
      </span>
    )}
  </button>
);

const SiteNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { oscuro, alternar } = useTema();
  const burgerRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  /* El menú del celular bloquea el scroll del fondo y cierra con Escape,
     devolviendo el foco al botón que lo abrió. Si la ventana crece hasta el
     diseño de escritorio con el menú abierto, se cierra: si no, el scroll
     quedaba bloqueado sin ningún menú a la vista. */
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    const escritorio = window.matchMedia?.("(min-width: 1100px)");
    const alCrecer = (e) => e.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    escritorio?.addEventListener?.("change", alCrecer);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      escritorio?.removeEventListener?.("change", alCrecer);
    };
  }, [open]);

  return (
    <nav className="snav" data-scrolled={scrolled} aria-label="Principal">
      <div className="snav-capsule">
        <Link
          to="/"
          className="snav-brand"
          onClick={() => setOpen(false)}
          aria-label={`${BRAND.name} — ${BRAND.person}`}
        >
          {/* Dos archivos transparentes, recortados al trazo: navy para el
              vidrio claro y blanco para el oscuro. El CSS muestra uno según
              `data-theme`; un <picture> con `prefers-color-scheme` no se
              enteraría del botón de tema. Se nombran por su ruta de
              `public/` y NO se importan: ver tests/imagenesServidas.test.js. */}
          <span className="snav-marca" aria-hidden="true">
            <img
              src="/marca-claro.webp"
              alt=""
              className="snav-mark snav-mark--claro"
              width="192"
              height="192"
              loading="lazy"
            />
            <img
              src="/marca-oscuro.webp"
              alt=""
              className="snav-mark snav-mark--oscuro"
              width="192"
              height="192"
              loading="lazy"
            />
          </span>
          <span className="snav-brand-copy">
            <span className="snav-brand-name">
              Tu Profesor <em>Particular</em>
            </span>
            <span className="snav-brand-person">{BRAND.person}</span>
          </span>
        </Link>

        <div className="snav-right" id="snav-menu" data-open={open}>
          <ul className="snav-links">
            {LINKS.map((link) => {
              const Icono = link.icon;
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) => `snav-link ${isActive ? "is-active" : ""}`}
                    onClick={() => setOpen(false)}
                    end={link.to === "/"}
                  >
                    <Icono aria-hidden="true" />
                    <span>{link.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
          <div className="snav-menu-tools">
            <BotonTema variante="menu" oscuro={oscuro} alternar={alternar} />
          </div>
        </div>

        <div className="snav-actions">
          <BotonTema variante="barra" oscuro={oscuro} alternar={alternar} />

          {/* El CTA sale del sitio hacia el sistema de turnos: se avisa. */}
          <a
            className="snav-cta"
            href={BOOKING_RESERVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <LuCalendarPlus aria-hidden="true" />
            <span className="snav-cta-largo">Reservar una clase</span>
            <span className="snav-cta-corto">Reservar</span>
            <LuArrowUpRight className="snav-cta-sale" aria-hidden="true" />
            <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>

          <button
            ref={burgerRef}
            type="button"
            className="snav-burger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="snav-menu"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <LuX aria-hidden="true" /> : <LuMenu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <button
          type="button"
          className="snav-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}

      <span className="sr-only" aria-live="polite">
        {pathname === "/" ? "Inicio" : ""}
      </span>
    </nav>
  );
};

export default SiteNav;
