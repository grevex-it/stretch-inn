// Formulario: no recarga la página al enviar.
import type { ReactNode } from "react";
import estilos from "./Formulario.module.css";

interface Props {
  alEnviar: () => void;
  children: ReactNode;
}

export function Formulario({ alEnviar, children }: Props) {
  return (
    <form
      className={estilos.formulario}
      onSubmit={(evento) => {
        evento.preventDefault();
        alEnviar();
      }}
    >
      {children}
    </form>
  );
}
