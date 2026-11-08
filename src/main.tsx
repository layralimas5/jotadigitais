import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "@fontsource/archivo-black";
import "./index.css";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { reloadForNewVersion } from "./app/new-version";
import { router } from "./app/router";

// Arquivo de uma versão que já saiu do ar: recarrega e segue na versão nova, sem tela de erro.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
