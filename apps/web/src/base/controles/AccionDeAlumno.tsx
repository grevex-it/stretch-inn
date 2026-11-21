// Buscar un alumno y confirmar una acción con él (inscribirlo, reservarle una recuperación). Al
// confirmar bien vuelve a empezar, sin búsqueda ni alumno elegido, para no dejar «Confirmar» listo
// para repetir, y avisa con quién se hizo. Si la API lo rechaza, queda como estaba, con el motivo.
import { useState } from "react";
import { Aviso } from "./Aviso.tsx";
import { BuscarAlumno } from "./BuscarAlumno.tsx";
import { FormularioDesplegable, FormularioRemoto } from "./FormularioRemoto.tsx";
import estilos from "./AccionDeAlumno.module.css";

export function AccionDeAlumno({ ruta, etiqueta }: { ruta: string; etiqueta: string }) {
  const [vuelta, empezarDeNuevo] = useState(0);
  const [listo, anotar] = useState<string>();
  return (
    <FormularioDesplegable titulo={etiqueta}>
      <Eleccion
        key={vuelta}
        ruta={ruta}
        alCambiar={() => {
          anotar(undefined);
        }}
        alConfirmar={(nombre) => {
          anotar(nombre);
          empezarDeNuevo((anterior) => anterior + 1);
        }}
      />
      {listo && (
        <div className={estilos.listo}>
          <Aviso tono="ok">{`Listo: ${listo}.`}</Aviso>
        </div>
      )}
    </FormularioDesplegable>
  );
}

function Eleccion({
  ruta,
  alCambiar,
  alConfirmar,
}: {
  ruta: string;
  alCambiar: () => void;
  alConfirmar: (nombre: string) => void;
}) {
  const [alumno, elegir] = useState<{ id: string; nombre: string }>();
  return (
    <>
      <BuscarAlumno
        alElegir={(elegido) => {
          elegir(elegido);
          alCambiar();
        }}
      />
      {alumno && (
        <FormularioRemoto
          key={alumno.id}
          ruta={ruta}
          metodo="POST"
          etiqueta="Confirmar"
          cuerpo={() => ({ alumnoId: alumno.id })}
          alGuardar={() => {
            alConfirmar(alumno.nombre);
          }}
        >
          <p>{alumno.nombre}</p>
        </FormularioRemoto>
      )}
    </>
  );
}
