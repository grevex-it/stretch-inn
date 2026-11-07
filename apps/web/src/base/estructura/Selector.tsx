// Selector con etiqueta para la barra del panel (centro y sede).
import { useId } from "react";
import estilos from "./Selector.module.css";

interface Props {
  etiqueta: string;
  ocultarEtiqueta?: boolean;
  valor: string;
  opciones: { valor: string; texto: string }[];
  alCambiar: (valor: string) => void;
  deshabilitado?: boolean;
}

export function Selector({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  deshabilitado = false,
  ocultarEtiqueta = false,
}: Props) {
  const id = useId();
  return (
    <div className={estilos.selector}>
      <label className={estilos.etiqueta} htmlFor={id} hidden={ocultarEtiqueta}>
        {etiqueta}
      </label>
      <select
        id={id}
        aria-label={ocultarEtiqueta ? etiqueta : undefined}
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
