import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Service Worker регистрируется только здесь, один раз и только в production.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // При активации новой версии перезагружаем вкладку, чтобы не оставаться на старом JS.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then(registration => registration.update())
      .catch(error => console.warn("Не удалось зарегистрировать Service Worker:", error));
  }, { once: true });
}
