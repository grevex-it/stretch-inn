// Botón: el principal en oliva, el secundario con borde (0018).
import type { ReactNode } from "react";
import estilos from "./Boton.module.css";

interface Props {
  children: ReactNode;
  variante?: "principal" | "secundario";
  tipo?: "button" | "submit";
  deshabilitado?: boolean;
  alHacerClic?: () => void;
}

export function Boton({
  children,
  variante = "principal",
  tipo = "button",
  deshabilitado = false,
  alHacerClic,
}: Props) {
  return (
    <button
      type={tipo}
      className={`${estilos.boton} ${estilos[variante]}`}
      disabled={deshabilitado}
      onClick={alHacerClic}
    >
      {children}
    </button>
  );
}
