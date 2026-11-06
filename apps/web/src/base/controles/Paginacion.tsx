// Anterior y siguiente de una lista paginada (ninguna lista sin paginar). Con una sola página no
// se muestra.
import { Boton } from "./Boton.tsx";
import estilos from "./Paginacion.module.css";

interface Props {
  pagina: { pagina: number; porPagina: number; total: number };
  alIrA: (pagina: number) => void;
}

export function Paginacion({ pagina, alIrA }: Props) {
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
