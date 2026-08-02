import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FaArrowUpRightFromSquare, FaBars, FaXmark } from "react-icons/fa6";
import { BOOKING_RESERVE_URL, BRAND } from "../data/site.js";
import monogram from "../assets/monogram.png";
import "./SiteNav.css";

const LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/sobre-mi", label: "Sobre mí" },
  { to: "/materias", label: "Materias" },
  { to: "/como-trabajo", label: "Cómo trabajo" },
  { to: "/contacto", label: "Contacto" },
];

/* Isla flotante: el <nav> es sólo el riel de posición y la cápsula es la barra.
   Mismo lenguaje que la app de turnos, para que las dos se sientan un producto. */
const SiteNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

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

  // El menú mobile bloquea el scroll del fondo y cierra con Escape.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className={`snav ${scrolled ? "is-scrolled" : ""}`} aria-label="Principal">
      <div className="snav-capsule">
        <Link
          to="/"
          className="snav-brand"
          onClick={() => setOpen(false)}
          aria-label={`${BRAND.name} — ${BRAND.person}`}
        >
          <img
            src={monogram}
            alt=""
            className="snav-mark"
            aria-hidden="true"
            width="38"
            height="38"
          />
          <span className="snav-brand-copy">
            <span className="snav-brand-name">
              Tu Profesor <em>Particular</em>
            </span>
            <span className="snav-brand-person">{BRAND.person}</span>
          </span>
        </Link>

        <button
          type="button"
          className="snav-burger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="snav-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <FaXmark aria-hidden="true" /> : <FaBars aria-hidden="true" />}
        </button>

        <div className={`snav-right ${open ? "is-open" : ""}`} id="snav-menu">
          <ul className="snav-links">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `snav-link ${isActive ? "is-active" : ""}`
                  }
                  onClick={() => setOpen(false)}
                  end={link.to === "/"}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* El CTA sale del sitio hacia el sistema de turnos: se avisa. */}
          <a
            className="snav-cta"
            href={BOOKING_RESERVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Reservar turno
            <FaArrowUpRightFromSquare aria-hidden="true" />
            <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
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
