// Pantalla Alumnos: lista con buscador, alta, edición y baja (0011). Sin personas.editar, la ficha
// se abre en solo lectura. Ocultar botones es solo UX: la API aplica cada regla.
import type { Alumno } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { usePermiso } from "../../base/sesion.ts";
import estilos from "./Alumnos.module.css";
import { Buscador } from "./Buscador.tsx";
import { useAlumnos, type Filtro } from "./consultas.ts";
import { FichaDeAlumno } from "./FichaDeAlumno.tsx";
import { TablaDeAlumnos } from "./TablaDeAlumnos.tsx";

/** Qué ficha está abierta: ninguna, una nueva o la de un alumno. */
type Editando = { alumno: Alumno | undefined } | null;

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
        <FichaDeAlumno
          key={editando.alumno?.id ?? "nuevo"}
          alumno={editando.alumno}
          soloLectura={!edita}
          alGuardar={(nombre) => {
            setEditando(null);
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
