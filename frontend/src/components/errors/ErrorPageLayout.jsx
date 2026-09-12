import { Link } from "react-router-dom";
import "./ErrorPageLayout.css";

/**
 * Shared layout for all error/status pages.
 * @param {Object} props
 * @param {React.ReactNode} props.illustration - SVG or image element
 * @param {string} props.title - Page title
 * @param {string} props.description - Description text
 * @param {Array<{label: string, to?: string, href?: string, onClick?: Function, variant?: string, external?: boolean}>} props.actions
 * @param {boolean} [props.isBoundary=false] - Use <a> instead of <Link> (when outside Router)
 * @param {string} [props.statusCode] - Optional status code to display
 * @param {string} [props.className] - Extra class on the root, for per-page skins
 * @param {React.ReactNode} [props.brand] - Brand lockup, for pages rendered outside the Navbar
 */
const ErrorPageLayout = ({
  brand,
  illustration,
  title,
  description,
  actions = [],
  isBoundary = false,
  statusCode,
  className = "",
}) => {
  return (
    <div className={`error-page ${className}`.trim()}>
      {/* La marca solo la usa mantenimiento, que se dibuja antes del Navbar y
          por lo tanto es la única pantalla de error que queda sin identidad
          alguna: sin esto se lee como un aviso del navegador y no como el
          sitio de Agustín. El 404 y el 500 viven dentro del router y ya tienen
          el logo arriba, así que no la pasan y no lo duplican. */}
      {brand && <div className="error-page-brand">{brand}</div>}

      {illustration && (
        <div className="error-page-illustration" aria-hidden="true">
          {illustration}
        </div>
      )}

      <h1 className="error-page-title">{title}</h1>
      <p className="error-page-description">{description}</p>

      {actions.length > 0 && (
        <div className="error-page-actions">
          {actions.map((action, i) => {
            const cls = `error-page-btn error-page-btn--${action.variant || (i === 0 ? "primary" : "secondary")}`;

            if (action.onClick) {
              return (
                <button key={i} type="button" className={cls} onClick={action.onClick}>
                  {action.label}
                </button>
              );
            }

            if (isBoundary || action.href) {
              /* `external` abre en otra pestaña con `noopener`: un enlace a
                 WhatsApp que se lleva la pestaña actual hace perder el lugar
                 en el que estaba la persona, y sin `noopener` el destino
                 queda con una referencia a esta ventana. */
              const externo = action.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : null;
              return (
                <a
                  key={i}
                  href={action.href || action.to || "/"}
                  className={cls}
                  {...externo}
                >
                  {action.label}
                </a>
              );
            }

            return (
              <Link key={i} to={action.to || "/"} className={cls}>
                {action.label}
              </Link>
            );
          })}
        </div>
      )}

      {statusCode && <p className="error-page-code">Error {statusCode}</p>}
    </div>
  );
};

export default ErrorPageLayout;
