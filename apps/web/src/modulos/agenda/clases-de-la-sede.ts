// Las clases de una sede con más fijos que unas camas: las que impiden bajarlas. Recorre todas las
// páginas de la lista (la API las da de a 50): la primera dice cuántas hay y las demás se piden
// juntas.
import { paginaDeClases, type Clase } from "@app/contratos";
import { consultar } from "../../base/api.ts";

export async function clasesQueImpiden(sede: string, camas: number): Promise<Clase[]> {
  const pagina = (numero: number) =>
    consultar(`/agenda/clases?sede=${sede}&pagina=${String(numero)}`, paginaDeClases);
  const primera = await pagina(1);
  const cuantas = Math.ceil(primera.total / Math.max(primera.porPagina, 1));
  const resto = await Promise.all(
    Array.from({ length: Math.max(cuantas - 1, 0) }, (_, i) => pagina(i + 2)),
  );
  return [primera, ...resto]
    .flatMap((p) => p.elementos)
    .filter((clase) => clase.inscriptos > camas);
}
