import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initPwa } from "./pwa";
import App from "./App";

// Inject the web manifest + brand icon for PWA installability.
initPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
