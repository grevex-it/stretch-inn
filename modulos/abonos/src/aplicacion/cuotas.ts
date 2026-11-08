// Casos de uso de las cuotas mensuales de los alumnos. [SUPUESTO] Una cuota por alumno y mes
// calendario del centro, con el precio de la sede congelado al generarla.
import {
  falla,
  ok,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Dinero,
  type Resultado,
} from "@app/nucleo";
import { esPeriodo, periodoDe } from "../dominio/periodo.ts";
import { ASIGNAR, VER } from "../dominio/permisos.ts";
import { precioEnSede } from "../dominio/plan.ts";
import { enSede, PLAN_INEXISTENTE, SIN_PERMISO } from "./planes.ts";
import type { Cuota, ErrorDeAbonos, Pagina, PaginaDe, RepositorioAbonos } from "./puertos.ts";

const CUOTA_INEXISTENTE = falla("cuota-inexistente", "Esa cuota no existe o ya se anuló.");

export async function generar(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  pedido: { alumnoId: string; planId: string; sedeId: string; periodo?: string },
): Promise<Resultado<{ id: string; monto: Dinero; periodo: string }, ErrorDeAbonos>> {
  const { alumnoId, planId, sedeId } = pedido;
  if (!enSede(quien, ASIGNAR, sedeId)) return SIN_PERMISO;
  const periodo = pedido.periodo ?? periodoDe(ahora, await repo.zonaHoraria());
  if (!esPeriodo(periodo)) return falla("periodo-invalido", "El mes va como AAAA-MM.");
  const plan = await repo.plan(planId);
  if (plan === undefined) return PLAN_INEXISTENTE;
  if (!plan.activo) return falla("plan-inactivo", "Ese plan está de baja.");
  const alumno = await repo.alumno(alumnoId);
  if (alumno === undefined)
    return falla("alumno-inexistente", "Ese alumno no existe en el centro.");
  if (!alumno.activo) return falla("alumno-de-baja", "Ese alumno está de baja: reactivalo antes.");
  const monto = precioEnSede(plan.precio, await repo.precioDeSede(planId, sedeId));
  const id = await repo.generarCuota({ alumnoId, planId, sedeId, periodo, monto });
  if (id === undefined) return falla("ya-tiene-cuota", "Ese alumno ya tiene la cuota de ese mes.");
  return ok({ id, monto, periodo });
}

/** Solo una cuota sin pagar; no la borra. */
export async function anular(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  { id }: { id: string },
): Promise<Resultado<null, ErrorDeAbonos>> {
  const cuota = await repo.cuota(id, true);
  if (cuota === undefined) return CUOTA_INEXISTENTE;
  if (!enSede(quien, ASIGNAR, cuota.sedeId)) return SIN_PERMISO;
  if (cuota.pagadaEn !== null) return falla("cuota-pagada", "Esa cuota ya está pagada.");
  await repo.anularCuota(id, ahora);
  return ok(null);
}

/** Las cuotas vigentes del alumno, la más nueva primero, en las sedes donde puede verlas. */
export async function deAlumno(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  { alumnoId, ...pagina }: Pagina & { alumnoId: string },
): Promise<Resultado<PaginaDe<Cuota>, ErrorDeAbonos>> {
  const sedeIds = sedesVisibles(quien).filter((sede) => puede(quien, VER, sede));
  return ok(await repo.cuotasDeAlumno({ ...pagina, alumnoId, sedeIds }));
}
