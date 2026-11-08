import { paginaDeAlumnos } from "@app/contratos";
import { useState } from "react";
import { ListaRemota, Resultados } from "./ListaRemota.tsx";

export function BuscarAlumno({
  alElegir,
}: {
  alElegir: (alumno: { id: string; nombre: string } | undefined) => void;
}) {
  const [buscar, cambiarBusqueda] = useState("");
  const ruta = "/alumnos?buscar=" + encodeURIComponent(buscar.trim());
  return (
    <>
      <label>
        Buscar alumno{" "}
        <input
          value={buscar}
          maxLength={100}
          onChange={(evento) => {
            cambiarBusqueda(evento.target.value);
            alElegir(undefined);
          }}
        />
      </label>
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
                <li key={item.id}>
                  <button
                    type="button"
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
    </>
  );
}
