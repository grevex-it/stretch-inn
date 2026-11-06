// La lista de alumnos: una tabla por página, de a 50. Sin resultados, lo dice con palabras.
import type { Alumno, PaginaDeAlumnos } from "@app/contratos";
import { Paginacion } from "../../base/controles/Paginacion.tsx";
import { FilaDeAlumno } from "./FilaDeAlumno.tsx";
import estilos from "./TablaDeAlumnos.module.css";

interface Props {
  pagina: PaginaDeAlumnos;
  buscar: string;
  edita: boolean;
  alIrA: (pagina: number) => void;
  alEditar: (alumno: Alumno) => void;
}

export function TablaDeAlumnos({ pagina, buscar, edita, alIrA, alEditar }: Props) {
  if (pagina.total === 0) {
    return (
      <p className={estilos.vacia}>
        {buscar === ""
          ? "Todavía no hay alumnos cargados."
          : `No encontramos alumnos con «${buscar}».`}
      </p>
    );
  }
  return (
    <>
      <table className={estilos.tabla}>
        <thead>
          <tr>
            <th scope="col">Alumno</th>
            <th scope="col">Teléfono</th>
            <th scope="col">Documento</th>
            <th scope="col">Estado</th>
            {edita && <th scope="col">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {pagina.elementos.map((alumno) => (
            <FilaDeAlumno key={alumno.id} alumno={alumno} edita={edita} alEditar={alEditar} />
          ))}
        </tbody>
      </table>
      <Paginacion pagina={pagina} alIrA={alIrA} />
    </>
  );
}
