import { useState } from "react";
import { BuscarAlumno } from "./BuscarAlumno.tsx";
import { FormularioDesplegable, FormularioRemoto } from "./FormularioRemoto.tsx";

export function AccionDeAlumno({ ruta, etiqueta }: { ruta: string; etiqueta: string }) {
  const [alumno, elegir] = useState<{ id: string; nombre: string }>();
  return (
    <FormularioDesplegable titulo={etiqueta}>
      <BuscarAlumno alElegir={elegir} />
      {alumno && (
        <FormularioRemoto
          key={alumno.id}
          ruta={ruta}
          metodo="POST"
          etiqueta="Confirmar"
          cuerpo={() => ({ alumnoId: alumno.id })}
        >
          <p>{alumno.nombre}</p>
        </FormularioRemoto>
      )}
    </FormularioDesplegable>
  );
}
