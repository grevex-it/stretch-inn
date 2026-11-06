// Selector con etiqueta para la barra del panel (centro y sede).
import { useId } from "react";
import estilos from "./Selector.module.css";

interface Props {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
  alCambiar: (valor: string) => void;
  deshabilitado?: boolean;
}

export function Selector({ etiqueta, valor, opciones, alCambiar, deshabilitado = false }: Props) {
  const id = useId();
  return (
    <div className={estilos.selector}>
      <label className={estilos.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={estilos.lista}
        value={valor}
        disabled={deshabilitado}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
