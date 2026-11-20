// Pantalla Alumnos: lista con buscador, alta, edición y baja (0011). Sin personas.editar, la ficha
// se abre en solo lectura. Ocultar botones es solo UX: la API aplica cada regla.
import type { Alumno } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { usePermiso } from "../../base/sesion.ts";
import estilos from "./Alumnos.module.css";
import { Buscador } from "./Buscador.tsx";
import { useAlumno, useAlumnos, type Filtro } from "./consultas.ts";
import { FichaDeAlumno } from "./FichaDeAlumno.tsx";
import { TablaDeAlumnos } from "./TablaDeAlumnos.tsx";

/**
 * Qué ficha está abierta: ninguna, una nueva, la de un alumno de la lista o la del que se acaba
 * de sumar (por su id: así se cargan enseguida sus datos de salud).
 */
type Editando = { alumno: Alumno | undefined } | { id: string } | null;

type PropsDeFicha = Omit<Parameters<typeof FichaDeAlumno>[0], "alumno">;

/** La ficha del alumno recién sumado: se pide a la API para tenerla con su versión. */
function FichaDelNuevo({ id, ...props }: PropsDeFicha & { id: string }) {
  const alumno = useAlumno(id);
  if (alumno.error !== null) return <Aviso tono="error">{mensajeDe(alumno.error)}</Aviso>;
  if (alumno.data === undefined) return null;
  return <FichaDeAlumno alumno={alumno.data} {...props} />;
}

function Ficha({ editando, ...props }: PropsDeFicha & { editando: NonNullable<Editando> }) {
  if ("id" in editando) return <FichaDelNuevo key={editando.id} id={editando.id} {...props} />;
  return <FichaDeAlumno key={editando.alumno?.id ?? "nuevo"} alumno={editando.alumno} {...props} />;
}

/** El buscador y la tabla. Cambiar la búsqueda o las bajas vuelve a la página 1. */
interface PropsDeLista {
  edita: boolean;
  daDeBaja: boolean;
  alAbrir: (alumno: Alumno) => void;
}

function Lista({ edita, daDeBaja, alAbrir }: PropsDeLista) {
  const [filtro, setFiltro] = useState<Filtro>({ pagina: 1, buscar: "", conBajas: false });
  const filtrar = (cambio: Partial<Filtro>) => {
    setFiltro((actual) => ({ ...actual, pagina: 1, ...cambio }));
  };
  const alumnos = useAlumnos(filtro);
  return (
    <>
      <Buscador
        conBajas={filtro.conBajas}
        alBuscar={(buscar) => {
          filtrar({ buscar });
        }}
        alCambiarBajas={(conBajas) => {
          filtrar({ conBajas });
        }}
      />
      {alumnos.error !== null && <Aviso tono="error">{mensajeDe(alumnos.error)}</Aviso>}
      {alumnos.data !== undefined && (
        <TablaDeAlumnos
          pagina={alumnos.data}
          buscar={filtro.buscar}
          edita={edita}
          daDeBaja={daDeBaja}
          alAbrir={alAbrir}
          alIrA={(pagina) => {
            filtrar({ pagina });
          }}
        />
      )}
    </>
  );
}

function Encabezado({ conBoton, alSumar }: { conBoton: boolean; alSumar: () => void }) {
  return (
    <div className={estilos.encabezado}>
      <h1 id="titulo-alumnos" className={estilos.titulo}>
        Alumnos
      </h1>
      {conBoton && <Boton alHacerClic={alSumar}>Sumar alumno</Boton>}
    </div>
  );
}

export function Alumnos() {
  const edita = usePermiso("personas.editar");
  const daDeBaja = usePermiso("personas.dar-de-baja");
  const [editando, setEditando] = useState<Editando>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const abrir = (alumno: Alumno | undefined) => {
    setGuardado(null);
    setEditando({ alumno });
  };
  return (
    <section className={estilos.alumnos} aria-labelledby="titulo-alumnos">
      <Encabezado
        conBoton={edita && editando === null}
        alSumar={() => {
          abrir(undefined);
        }}
      />
      {guardado !== null && <Aviso tono="ok">Guardamos a {guardado}.</Aviso>}
      {editando !== null && (
        <Ficha
          editando={editando}
          soloLectura={!edita}
          alGuardar={(nombre, idNuevo) => {
            setEditando(idNuevo === undefined ? null : { id: idNuevo });
            setGuardado(nombre);
          }}
          alCancelar={() => {
            setEditando(null);
          }}
        />
      )}
      <Lista edita={edita} daDeBaja={daDeBaja} alAbrir={abrir} />
    </section>
  );
}
