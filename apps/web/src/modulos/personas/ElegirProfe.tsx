// El profe asignado: cualquier integrante activo del equipo (0022; Lore es Dueño y también da
// clases). La lista se pide solo para editar (personas.editar); en solo lectura alcanza con el
// nombre que trae el alumno. Un profe que ya no está activo sigue apareciendo con su nombre.
import { useId } from "react";
import { useProfes } from "./consultas.ts";
import estilos from "./ElegirProfe.module.css";

interface Props {
  valor: string;
  /** El nombre del profe que ya tiene el alumno, por si no está en la lista. */
  nombreActual: string | null;
  soloLectura: boolean;
  alCambiar: (valor: string) => void;
}

function opcionesDe(
  lista: { id: string; nombre: string }[],
  valor: string,
  nombreActual: string | null,
) {
  if (valor === "" || lista.some((profe) => profe.id === valor)) return lista;
  return [...lista, { id: valor, nombre: nombreActual ?? "Profe sin nombre" }];
}

export function ElegirProfe({ valor, nombreActual, soloLectura, alCambiar }: Props) {
  const id = useId();
  const profes = useProfes(!soloLectura);
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        Profe
      </label>
      <select
        id={id}
        className={estilos.lista}
        value={valor}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      >
        <option value="">Sin profe</option>
        {opcionesDe(profes.data ?? [], valor, nombreActual).map((profe) => (
          <option key={profe.id} value={profe.id}>
            {profe.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
