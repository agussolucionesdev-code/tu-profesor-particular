import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Tipografía autohospedada (bundleada por Vite, sin CDN externo).
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/inter/wght.css";
import "./styles/base.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
