// La lista del equipo: una tabla por página, de a 50 (ninguna lista sin paginar).
import type { PaginaDeEquipo } from "@app/contratos";
import { Boton } from "../../base/controles/Boton.tsx";
import { FilaDeIntegrante } from "./FilaDeIntegrante.tsx";
import estilos from "./TablaDeEquipo.module.css";

interface Props {
  pagina: PaginaDeEquipo;
  nombresDeSedes: ReadonlyMap<string, string>;
  gestiona: boolean;
  alIrA: (pagina: number) => void;
  alGenerarClave: (nombre: string, clave: string) => void;
}

function Paginacion({ pagina, alIrA }: Pick<Props, "pagina" | "alIrA">) {
  const paginas = Math.max(1, Math.ceil(pagina.total / pagina.porPagina));
  if (paginas === 1) return null;
  return (
    <div className={estilos.paginacion}>
      <Boton
        variante="secundario"
        deshabilitado={pagina.pagina <= 1}
        alHacerClic={() => {
          alIrA(pagina.pagina - 1);
        }}
      >
        Anterior
      </Boton>
      <span>
        Página {pagina.pagina} de {paginas}
      </span>
      <Boton
        variante="secundario"
        deshabilitado={pagina.pagina >= paginas}
        alHacerClic={() => {
          alIrA(pagina.pagina + 1);
        }}
      >
        Siguiente
      </Boton>
    </div>
  );
}

export function TablaDeEquipo({ pagina, nombresDeSedes, gestiona, alIrA, alGenerarClave }: Props) {
  return (
    <>
      <table className={estilos.tabla}>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Email</th>
            <th scope="col">Roles</th>
            <th scope="col">Estado</th>
            {gestiona && <th scope="col">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {pagina.elementos.map((integrante) => (
            <FilaDeIntegrante
              key={integrante.id}
              integrante={integrante}
              nombresDeSedes={nombresDeSedes}
              gestiona={gestiona}
              alGenerarClave={alGenerarClave}
            />
          ))}
        </tbody>
      </table>
      <Paginacion pagina={pagina} alIrA={alIrA} />
    </>
  );
}
