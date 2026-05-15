import { Component } from "react";
import ServerErrorPage from "./errors/ServerErrorPage";

/**
 * Catches unhandled render errors so the app shows a branded recovery screen
 * instead of a blank white page in production.
 *
 * Renders outside the Router, so ServerErrorPage receives isBoundary=true
 * to use <a> tags instead of <Link>.
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
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage isBoundary />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
