// Buscar y elegir un alumno: el buscador con su etiqueta arriba (Campo, 48px) y cada resultado
// como una fila que se elige (0018).
import { paginaDeAlumnos } from "@app/contratos";
import { useState } from "react";
import { Campo } from "./Campo.tsx";
import { ListaRemota, Resultados } from "./ListaRemota.tsx";
import estilos from "./BuscarAlumno.module.css";

export function BuscarAlumno({
  alElegir,
}: {
  alElegir: (alumno: { id: string; nombre: string } | undefined) => void;
}) {
  const [buscar, cambiarBusqueda] = useState("");
  const ruta = "/alumnos?buscar=" + encodeURIComponent(buscar.trim());
  return (
    <div className={estilos.buscar}>
      <Campo
        etiqueta="Buscar alumno"
        tipo="search"
        valor={buscar}
        largoMaximo={100}
        opcional
        alCambiar={(valor) => {
          cambiarBusqueda(valor);
          alElegir(undefined);
        }}
      />
      {buscar.trim() && (
        <ListaRemota
          key={ruta}
          ruta={ruta}
          esquema={paginaDeAlumnos}
          mostrar={(datos, alIrA) => (
            <Resultados
              datos={datos}
              alIrA={alIrA}
              fila={(item) => (
                <li key={item.id} className={estilos.fila}>
                  <button
                    type="button"
                    className={estilos.opcion}
                    onClick={() => {
                      alElegir({ id: item.id, nombre: item.nombre + " " + item.apellido });
                    }}
                  >
                    {item.nombre} {item.apellido}
                  </button>
                </li>
              )}
            />
          )}
        />
      )}
    </div>
  );
}
