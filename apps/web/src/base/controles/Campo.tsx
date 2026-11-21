// Campo de formulario con su etiqueta. Alto cómodo al tacto (0018).
import { useId } from "react";
import estilos from "./Campo.module.css";

interface Props {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  tipo?: "email" | "password" | "text" | "tel" | "date" | "search";
  autoComplete?: string;
  ayuda?: string;
  largoMaximo?: number;
  /** Se puede dejar vacío. Por defecto es obligatorio. */
  opcional?: boolean;
}

export function Campo({
  etiqueta,
  valor,
  alCambiar,
  tipo = "text",
  autoComplete,
  ayuda,
  largoMaximo,
  opcional = false,
}: Props) {
  const id = useId();
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        className={estilos.entrada}
        type={tipo}
        value={valor}
        autoComplete={autoComplete}
        maxLength={largoMaximo}
        required={!opcional}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      />
      {ayuda !== undefined && <p className={estilos.ayuda}>{ayuda}</p>}
    </div>
  );
}
