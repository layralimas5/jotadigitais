import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "@fontsource/archivo-black";
import "./index.css";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
