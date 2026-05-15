import { Link } from "react-router-dom";
import "./ErrorPageLayout.css";

/**
 * Shared layout for all error/status pages.
 * @param {Object} props
 * @param {React.ReactNode} props.illustration - SVG or image element
 * @param {string} props.title - Page title
 * @param {string} props.description - Description text
 * @param {Array<{label: string, to?: string, href?: string, onClick?: Function, variant?: string}>} props.actions
 * @param {boolean} [props.isBoundary=false] - Use <a> instead of <Link> (when outside Router)
 * @param {string} [props.statusCode] - Optional status code to display
 */
const ErrorPageLayout = ({
  illustration,
  title,
  description,
  actions = [],
  isBoundary = false,
  statusCode,
}) => {
  return (
    <div className="error-page">
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
              return (
                <a key={i} href={action.href || action.to || "/"} className={cls}>
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
