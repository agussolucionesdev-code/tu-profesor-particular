import { Component } from "react";

/**
 * Catches unhandled render errors so the app shows a recovery screen
 * instead of a blank white page in production.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; replace with a real logger (Sentry, etc.) in prod
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "var(--bg-page, #eef3f9)",
            color: "var(--text-primary, #1a2b3c)",
          }}
        >
          <span style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</span>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              margin: "0 0 0.5rem",
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              color: "var(--text-secondary, #5a7080)",
              maxWidth: "360px",
              margin: "0 0 1.5rem",
              lineHeight: 1.5,
            }}
          >
            Ocurrió un error inesperado. Recargá la página para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "8px",
              background: "var(--accent-primary, #3f8f57)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
