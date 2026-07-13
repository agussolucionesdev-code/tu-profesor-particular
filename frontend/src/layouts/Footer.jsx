import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaArrowUp,
  FaBrain,
  FaCalendarAlt,
  FaEnvelope,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaMapMarkerAlt,
  FaUserCheck,
  FaUserCog,
  FaUserLock,
  FaWhatsapp,
} from "react-icons/fa";
import ThemeLogo from "../components/ui/ThemeLogo";
import Reveal from "../components/ui/Reveal";
import useInView from "../hooks/useInView";
import "./Footer.css";

const FOOTER_LINKS = [
  {
    to: "/reservar",
    label: "Reservar tu turno",
    icon: <FaCalendarAlt aria-hidden="true" />,
  },
  {
    to: "/portal",
    label: "Ver mis turnos",
    icon: <FaUserLock aria-hidden="true" />,
  },
  {
    to: "/admin",
    label: "Panel del profesor",
    icon: <FaUserCog aria-hidden="true" />,
  },
];

const SOCIAL_LINKS = [
  {
    href: import.meta.env.VITE_INSTAGRAM_URL,
    label: "Instagram",
    icon: <FaInstagram aria-hidden="true" />,
    className: "social-bubble insta",
  },
  {
    href: import.meta.env.VITE_FACEBOOK_URL,
    label: "Facebook",
    icon: <FaFacebookF aria-hidden="true" />,
    className: "social-bubble fb",
  },
  {
    href: import.meta.env.VITE_LINKEDIN_URL,
    label: "LinkedIn",
    icon: <FaLinkedinIn aria-hidden="true" />,
    className: "social-bubble in",
  },
];

const CONFIGURED_SOCIAL_LINKS = SOCIAL_LINKS.filter((item) => item.href);

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [linksRef, linksVisible] = useInView({ threshold: 0.2 });

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <footer className="footer-elite">
        <div className="footer-ambient-glow"></div>

        <div className="footer-grid-container">
          <Reveal direction="left" delay={0} className="footer-brand-col">
            <div className="footer-header-brand">
              <div className="logo-premium-wrapper">
                <ThemeLogo variant="monogram" imgClassName="logo-img-transparent" alt="Tu Profesor Particular" />
              </div>

              <div className="brand-titles">
                <h3>Agustín Elías Sosa</h3>
                <span>Tu profesor particular</span>
              </div>
            </div>

            <div className="brand-philosophy">
              <h4 className="neuro-hook">Clases particulares con orden, cercanía y seguimiento.</h4>
              <p className="neuro-copy">
                Un espacio para aprender con claridad, resolver dudas y llegar
                a cada clase con un plan concreto, humano y adaptado a vos.
              </p>
            </div>

            <div className="footer-value-tags">
              <span className="value-tag">
                <FaUserCheck aria-hidden="true" /> ATENCIÓN PERSONALIZADA
              </span>
              <span className="value-tag">
                <FaBrain aria-hidden="true" /> ACOMPAÑAMIENTO CLARO
              </span>
              <span className="value-tag">
                <FaGlobe aria-hidden="true" /> GESTIÓN SIMPLE
              </span>
            </div>
          </Reveal>

          <Reveal direction="up" delay={80} className="footer-nav-col">
            <h4 className="footer-section-title">Explorar</h4>
            <nav aria-label="Navegación del pie de página">
              <ul ref={linksRef} className={`footer-links-list reveal-list stagger-auto${linksVisible ? " is-visible" : ""}`}>
                {FOOTER_LINKS.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="footer-link-item">
                      <div className="link-icon-box">{item.icon}</div>
                      <span className="link-text">{item.label}</span>
                      <FaArrowRight className="link-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>

          <Reveal direction="right" delay={160} className="footer-contact-col">
            <h4 className="footer-section-title">Hablemos</h4>
            <address className="footer-contact-address">
              <a
                href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn,%20vengo%20desde%20tu%20sitio%20web%20y%20me%20gustar%C3%ADa%20consultar%20por%20clases."
                target="_blank"
                rel="noreferrer"
                className="contact-card wp-card"
              >
                <div className="contact-icon" aria-hidden="true">
                  <FaWhatsapp />
                </div>
                <div className="contact-details">
                  <span className="contact-label">
                    Asesoramiento vía WhatsApp
                  </span>
                  <span className="contact-value">+54 9 11 6423-6675</span>
                </div>
              </a>

              <a
                href="mailto:agustinsosa.profe@gmail.com"
                className="contact-card email-card"
              >
                <div className="contact-icon" aria-hidden="true">
                  <FaEnvelope />
                </div>
                <div className="contact-details">
                  <span className="contact-label">Consultas por email</span>
                  <span className="contact-value">
                    agustinsosa.profe@gmail.com
                  </span>
                </div>
              </a>

              <a
                href="https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires"
                target="_blank"
                rel="noreferrer"
                className="contact-card location-card"
              >
                <div className="contact-icon" aria-hidden="true">
                  <FaMapMarkerAlt />
                </div>
                <div className="contact-details">
                  <span className="contact-label">Ubicación presencial</span>
                  <span className="contact-value">Temperley, Bs. As.</span>
                </div>
              </a>
            </address>
          </Reveal>
        </div>

        <Reveal direction="fade" delay={200} as="div">
        <div className="footer-bottom-panel">
          <div className="bottom-panel-container">
            <div className="copyright-area">
              <p>
                &copy; {currentYear} <strong>Agustín Elías Sosa</strong>. Todos
                los derechos reservados.
              </p>
              <span className="copyright-sub">
                Experiencia digital diseñada para reservar, gestionar y volver
                con claridad.
              </span>
            </div>

            {CONFIGURED_SOCIAL_LINKS.length > 0 && (
            <div className="social-area" aria-label="Redes sociales">
              {CONFIGURED_SOCIAL_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={item.className}
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.icon}
                </a>
              ))}
            </div>
            )}
          </div>
        </div>
        </Reveal>
      </footer>

      <button
        type="button"
        className={`btn-up-floating ${showTopBtn ? "visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Volver al inicio de la página"
      >
        <FaArrowUp aria-hidden="true" />
      </button>
    </>
  );
};

export default Footer;
