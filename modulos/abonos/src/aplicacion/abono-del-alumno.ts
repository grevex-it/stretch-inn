// El abono actual de un alumno en una sede, con las clases que le quedan (0020). Lo ve quien ve
// los abonos de esa sede: la ficha del alumno y el profe que da la clase.
import { ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { diaDe } from "../dominio/ciclo.ts";
import { estadoDelAbono } from "../dominio/estado.ts";
import { VER } from "../dominio/permisos.ts";
import { enSede, SIN_PERMISO } from "./planes.ts";
import type { AbonoDelAlumno, ErrorDeAbonos, RepositorioAbonos } from "./puertos.ts";

/** El que empezó más tarde hasta hoy, aunque ya haya usado todas sus clases; null si no hay. */
export async function abonoDelAlumno(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  { alumnoId, sedeId }: { alumnoId: string; sedeId: string },
): Promise<Resultado<AbonoDelAlumno | null, ErrorDeAbonos>> {
  if (!enSede(quien, VER, sedeId)) return SIN_PERMISO;
  const hoy = diaDe(ahora, await repo.zonaHoraria());
  const cuota = await repo.cuotaEmpezada({ alumnoId, sedeId, hoy });
  if (cuota === undefined) return ok(null);
  const { id, desde, clases, pagadaEn } = cuota;
  const fechas = await repo.fechasDeAlumno({ alumnoId, sedeId, desde, cantidad: clases });
  const estado = estadoDelAbono(clases, fechas, ahora);
  return ok({ cuotaId: id, desde, clases, ...estado, pagada: pagadaEn !== null });
}
