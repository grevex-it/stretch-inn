// La lista de alumnos: una tabla por página, de a 50. Sin resultados, lo dice con palabras.
import type { Alumno, PaginaDeAlumnos } from "@app/contratos";
import { Paginacion } from "../../base/controles/Paginacion.tsx";
import { FilaDeAlumno } from "./FilaDeAlumno.tsx";
import estilos from "./TablaDeAlumnos.module.css";

interface Props {
  pagina: PaginaDeAlumnos;
  buscar: string;
  edita: boolean;
  daDeBaja: boolean;
  alIrA: (pagina: number) => void;
  alAbrir: (alumno: Alumno) => void;
}

export function TablaDeAlumnos({ pagina, buscar, edita, daDeBaja, alIrA, alAbrir }: Props) {
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
      <div className={estilos.marco}>
        <table className={estilos.tabla}>
          <thead>
            <tr>
              <th scope="col">Alumno</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Documento</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagina.elementos.map((alumno) => (
              <FilaDeAlumno
                key={alumno.id}
                alumno={alumno}
                edita={edita}
                daDeBaja={daDeBaja}
                alAbrir={alAbrir}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} alIrA={alIrA} />
    </>
  );
}
