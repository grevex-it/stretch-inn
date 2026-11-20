// Antecedentes y patologías del alumno: aparte de la ficha y con permisos propios (0019). Se ven
// con personas.ver-salud y se guardan con personas.editar-salud, con su propia versión (0013): si
// otra persona los cambió en el medio, la API avisa, se muestra lo que hay ahora y, aparte, lo que
// se había escrito, para volver a cargarlo sin perderlo.
import type { SaludDeAlumno } from "@app/contratos";
import { useId, useState } from "react";
import { ErrorDeApi } from "../../base/api.ts";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import { usePermiso } from "../../base/sesion.ts";
import { useGuardarSalud, useSalud } from "./consultas.ts";
import estilos from "./SaludDelAlumno.module.css";

interface PropsDeFormulario {
  salud: SaludDeAlumno;
  titulo: string;
  edita: boolean;
  enviando: boolean;
  alGuardar: (salud: SaludDeAlumno) => void;
}

function FormularioDeSalud({ salud, titulo, edita, enviando, alGuardar }: PropsDeFormulario) {
  const [patologias, setPatologias] = useState(salud.patologias);
  return (
    <Formulario
      alEnviar={() => {
        if (edita) alGuardar({ patologias, version: salud.version });
      }}
    >
      <textarea
        aria-labelledby={titulo}
        className={estilos.patologias}
        value={patologias}
        rows={4}
        disabled={!edita}
        onChange={(evento) => {
          setPatologias(evento.target.value);
        }}
      />
      {edita && (
        <div>
          <Boton tipo="submit" variante="secundario" deshabilitado={enviando}>
            Guardar antecedentes
          </Boton>
        </div>
      )}
    </Formulario>
  );
}

/** Lo que la persona había escrito cuando la API respondió que los datos cambiaron (409). */
function LoQueHabiasEscrito({ texto }: { texto: string }) {
  const titulo = useId();
  return (
    <section className={estilos.escrito} aria-labelledby={titulo}>
      <h4 id={titulo} className={estilos.subtitulo}>
        Lo que habías escrito
      </h4>
      <p className={estilos.texto}>{texto}</p>
    </section>
  );
}

const cambioEnElMedio = (error: Error) => error instanceof ErrorDeApi && error.estado === 409;

function useGuardarSinPerder(alumnoId: string) {
  const guardar = useGuardarSalud(alumnoId);
  const [escrito, setEscrito] = useState<string | null>(null);
  const mutar = (datos: SaludDeAlumno) => {
    guardar.mutate(datos, {
      onSuccess: () => {
        setEscrito(null);
      },
      onError: (error) => {
        if (cambioEnElMedio(error)) setEscrito(datos.patologias);
      },
    });
  };
  return { guardar, escrito, mutar };
}

function Contenido({ alumnoId, titulo }: { alumnoId: string; titulo: string }) {
  const edita = usePermiso("personas.editar-salud");
  const salud = useSalud(alumnoId, true);
  const { guardar, escrito, mutar } = useGuardarSinPerder(alumnoId);
  const error = mensajeDe(salud.error) ?? mensajeDe(guardar.error);
  return (
    <>
      {salud.data !== undefined && (
        <FormularioDeSalud
          key={salud.data.version}
          salud={salud.data}
          titulo={titulo}
          edita={edita}
          enviando={guardar.isPending}
          alGuardar={mutar}
        />
      )}
      {error !== undefined && <Aviso tono="error">{error}</Aviso>}
      {escrito !== null && <LoQueHabiasEscrito texto={escrito} />}
      {guardar.isSuccess && <Aviso tono="ok">Guardamos los antecedentes.</Aviso>}
    </>
  );
}

export function SaludDelAlumno({ alumnoId }: { alumnoId: string }) {
  const titulo = useId();
  const ve = usePermiso("personas.ver-salud");
  if (!ve) return null;
  return (
    <section className={estilos.salud} aria-labelledby={titulo}>
      <h3 id={titulo} className={estilos.titulo}>
        Antecedentes y patologías
      </h3>
      <Contenido alumnoId={alumnoId} titulo={titulo} />
    </section>
  );
}
