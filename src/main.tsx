import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootEl = document.getElementById("root")!;
// Garde-fou : si le pont IPC est indisponible, afficher une erreur explicite plutôt qu'un écran vide.
if (!window.apex) {
  rootEl.innerHTML =
    "<div style='font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#1c2438;color:#eef1f8;border-radius:14px'>" +
    "<h2>Échec du démarrage de l'interface</h2>" +
    "<p>Le pont de communication avec l'application est indisponible (preload non chargé).</p>" +
    "<p>Réinstallez Apex Launcher depuis <b>ApexLauncher-Setup-x64.exe</b>, ou lancez-le depuis un terminal pour voir l'erreur exacte.</p></div>";
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
