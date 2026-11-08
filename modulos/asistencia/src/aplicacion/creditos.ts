// Casos de uso de los créditos de recuperación. Se ven en las sedes donde se puede ver la
// asistencia (0007): un crédito se usa en la sede de la fecha a la que se faltó.
import { ok, puede, sedesVisibles, type ContextoCentro, type Resultado } from "@app/nucleo";
import { VER } from "../dominio/permisos.ts";
import type {
  Credito,
  ErrorDeAsistencia,
  Pagina,
  PaginaDe,
  RepositorioAsistencia,
} from "./puertos.ts";

/** Los vigentes (sin anular ni vencer), el que vence antes primero. */
export async function deAlumno(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { alumnoId, ...pagina }: Pagina & { alumnoId: string },
): Promise<Resultado<PaginaDe<Credito>, ErrorDeAsistencia>> {
  const sedeIds = sedesVisibles(quien).filter((sede) => puede(quien, VER, sede));
  return ok(await repo.creditos({ ...pagina, alumnoId, sedeIds, ahora }));
}
