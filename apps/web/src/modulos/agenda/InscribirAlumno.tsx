// Inscribir un alumno en una clase: se busca, se elige y se confirma. Al inscribirlo, el
// formulario vuelve a empezar (sin búsqueda ni alumno elegido), para no dejar «Confirmar» listo
// para repetir; si la API lo rechaza, queda como estaba para corregir.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { enviar } from "../../base/api.ts";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { BuscarAlumno } from "../../base/controles/BuscarAlumno.tsx";
import { FormularioDesplegable } from "../../base/controles/FormularioRemoto.tsx";
import estilos from "./InscribirAlumno.module.css";

interface Alumno {
  id: string;
  nombre: string;
}

export function InscribirAlumno({ claseId }: { claseId: string }) {
  const [vuelta, empezarDeNuevo] = useState(0);
  const [inscripto, anotar] = useState<string>();
  return (
    <FormularioDesplegable titulo="Inscribir alumno">
      <div className={estilos.inscribir}>
        <Eleccion
          key={vuelta}
          claseId={claseId}
          alCambiar={() => {
            anotar(undefined);
          }}
          alInscribir={(nombre) => {
            anotar(nombre);
            empezarDeNuevo((anterior) => anterior + 1);
          }}
        />
        {inscripto && <Aviso tono="ok">{`Inscribiste a ${inscripto}.`}</Aviso>}
      </div>
    </FormularioDesplegable>
  );
}

function Eleccion({
  claseId,
  alCambiar,
  alInscribir,
}: {
  claseId: string;
  alCambiar: () => void;
  alInscribir: (nombre: string) => void;
}) {
  const [alumno, elegir] = useState<Alumno>();
  return (
    <>
      <BuscarAlumno
        alElegir={(elegido) => {
          elegir(elegido);
          alCambiar();
        }}
      />
      {alumno && (
        <Confirmacion key={alumno.id} claseId={claseId} alumno={alumno} alInscribir={alInscribir} />
      )}
    </>
  );
}

function Confirmacion({
  claseId,
  alumno,
  alInscribir,
}: {
  claseId: string;
  alumno: Alumno;
  alInscribir: (nombre: string) => void;
}) {
  const cliente = useQueryClient();
  const inscribir = useMutation({
    mutationFn: () =>
      enviar("POST", `/agenda/clases/${claseId}/inscriptos`, { alumnoId: alumno.id }),
    onSuccess: async () => {
      await cliente.invalidateQueries();
      alInscribir(alumno.nombre);
    },
  });
  return (
    <form
      className={estilos.confirmar}
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!inscribir.isPending) inscribir.mutate();
      }}
    >
      <p className={estilos.alumno}>{alumno.nombre}</p>
      {inscribir.isError && <Aviso tono="error">{mensajeDe(inscribir.error)}</Aviso>}
      <Boton tipo="submit" deshabilitado={inscribir.isPending}>
        Confirmar
      </Boton>
    </form>
  );
}
