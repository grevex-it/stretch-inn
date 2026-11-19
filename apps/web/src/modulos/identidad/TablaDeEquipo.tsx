// La lista del equipo: una tabla por página, de a 50 (ninguna lista sin paginar).
import type { PaginaDeEquipo } from "@app/contratos";
import { Paginacion } from "../../base/controles/Paginacion.tsx";
import { FilaDeIntegrante } from "./FilaDeIntegrante.tsx";
import estilos from "./TablaDeEquipo.module.css";

interface Props {
  pagina: PaginaDeEquipo;
  nombresDeSedes: ReadonlyMap<string, string>;
  gestiona: boolean;
  alIrA: (pagina: number) => void;
  alGenerarClave: (nombre: string, clave: string) => void;
  alVerPermisos: (integrante: { id: string; nombre: string }) => void;
}

export function TablaDeEquipo({ pagina, alIrA, ...fila }: Props) {
  return (
    <>
      <table className={estilos.tabla}>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Email</th>
            <th scope="col">Roles</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pagina.elementos.map((integrante) => (
            <FilaDeIntegrante key={integrante.id} integrante={integrante} {...fila} />
          ))}
        </tbody>
      </table>
      <Paginacion pagina={pagina} alIrA={alIrA} />
    </>
  );
}
