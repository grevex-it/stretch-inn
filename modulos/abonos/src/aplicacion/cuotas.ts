// Casos de uso de las cuotas de los alumnos: un paquete de clases (0020), con el precio de la sede
// congelado al generarla. Cada fecha del horario fijo gasta una clase; los abonos de un alumno no
// se pisan.
import {
  falla,
  ok,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Dinero,
  type Resultado,
} from "@app/nucleo";
import { diaDe, diaSiguiente, esDia } from "../dominio/ciclo.ts";
import { ASIGNAR, VER } from "../dominio/permisos.ts";
import { precioEnSede } from "../dominio/plan.ts";
import { enSede, PLAN_INEXISTENTE, SIN_PERMISO } from "./planes.ts";
import type { Cuota, ErrorDeAbonos, Pagina, PaginaDe, Plan, RepositorioAbonos } from "./puertos.ts";

const CUOTA_INEXISTENTE = falla("cuota-inexistente", "Esa cuota no existe o ya se anuló.");
const PISADA = falla("ya-tiene-cuota", "Ese alumno ya tiene un abono en esas fechas.");

/**
 * Hasta qué día va una cuota: el de su última clase. Si no le alcanzan las fechas del horario
 * fijo (por ejemplo, la clase suelta de quien no tiene horario), el día en que empieza.
 */
async function hastaCuando(
  repo: RepositorioAbonos,
  cuota: Cuota,
): Promise<{ ultimoDia: string; completa: boolean }> {
  const { alumnoId, sedeId, desde, clases } = cuota;
  const fechas = await repo.fechasDeAlumno({ alumnoId, sedeId, desde, cantidad: clases });
  const ultima = fechas.length === clases ? fechas.at(-1) : undefined;
  return ultima === undefined
    ? { ultimoDia: desde, completa: false }
    : { ultimoDia: ultima.fecha, completa: true };
}

/** El plan activo y el alumno activo del centro, o por qué no se puede generar la cuota. */
async function planYAlumno(
  repo: RepositorioAbonos,
  { alumnoId, planId }: { alumnoId: string; planId: string },
): Promise<Resultado<Omit<Plan, "preciosDeSede">, ErrorDeAbonos>> {
  const plan = await repo.plan(planId);
  if (plan === undefined) return PLAN_INEXISTENTE;
  if (!plan.activo) return falla("plan-inactivo", "Ese plan está de baja.");
  const alumno = await repo.alumno(alumnoId);
  if (alumno === undefined) {
    return falla("alumno-inexistente", "Ese alumno no existe en el centro.");
  }
  if (!alumno.activo) return falla("alumno-de-baja", "Ese alumno está de baja: reactivalo antes.");
  return ok(plan);
}

/**
 * Desde qué día cuenta la cuota nueva, o undefined si pisa el abono anterior. Sin día pedido,
 * sigue al anterior: siguió viniendo y su fecha de pago no se corre (0020).
 */
async function desdeCuando(
  repo: RepositorioAbonos,
  alumnoId: string,
  pedido: string | undefined,
  ahora: Date,
): Promise<string | undefined> {
  const anterior = await repo.ultimaCuota(alumnoId);
  const fin = anterior && (await hastaCuando(repo, anterior));
  const desde =
    pedido ??
    (fin?.completa ? diaSiguiente(fin.ultimoDia) : diaDe(ahora, await repo.zonaHoraria()));
  return fin !== undefined && desde <= fin.ultimoDia ? undefined : desde;
}

export async function generar(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  pedido: { alumnoId: string; planId: string; sedeId: string; desde?: string },
): Promise<Resultado<{ id: string; monto: Dinero; desde: string; clases: number }, ErrorDeAbonos>> {
  const { alumnoId, planId, sedeId } = pedido;
  if (!enSede(quien, ASIGNAR, sedeId)) return SIN_PERMISO;
  if (pedido.desde !== undefined && !esDia(pedido.desde)) {
    return falla("dia-invalido", "El día va como AAAA-MM-DD.");
  }
  const plan = await planYAlumno(repo, pedido);
  if (!plan.ok) return plan;
  await repo.bloquearAlumno(alumnoId);
  const desde = await desdeCuando(repo, alumnoId, pedido.desde, ahora);
  if (desde === undefined) return PISADA;
  const { clases, precio } = plan.valor;
  const monto = precioEnSede(precio, await repo.precioDeSede(planId, sedeId));
  const id = await repo.generarCuota({ alumnoId, planId, sedeId, desde, clases, monto });
  if (id === undefined) return PISADA;
  return ok({ id, monto, desde, clases });
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
