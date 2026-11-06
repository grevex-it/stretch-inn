// Punto de entrada del panel.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Aplicacion } from "./base/Aplicacion.tsx";
import { crearClienteDeConsultas } from "./base/consultas.ts";
import "./base/estilos.css";

const raiz = document.getElementById("raiz");
if (raiz === null) throw new Error("Falta el elemento #raiz en index.html.");

createRoot(raiz).render(
  <StrictMode>
    <Aplicacion clienteDeConsultas={crearClienteDeConsultas()} />
  </StrictMode>,
);
