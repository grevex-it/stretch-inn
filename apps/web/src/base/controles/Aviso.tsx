// Mensaje para el usuario. Un error se anuncia en el momento (alert); un aviso, sin cortar (status).
import type { ReactNode } from "react";
import { ErrorDeApi } from "../api.ts";
import estilos from "./Aviso.module.css";

interface Props {
  children: ReactNode;
  tono: "error" | "alerta" | "ok";
}

export function Aviso({ children, tono }: Props) {
  return (
    <p className={`${estilos.aviso} ${estilos[tono]}`} role={tono === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

/** El mensaje de un error para mostrar: el de la API ya viene en palabras del usuario. */
export function mensajeDe(error: Error | null): string | undefined {
  if (error === null) return undefined;
  return error instanceof ErrorDeApi ? error.message : "Algo falló. Probá de nuevo en un rato.";
}
