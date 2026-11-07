// Casos de uso de las clases semanales. Cada permiso se controla en la sede de la clase (0007).
import {
  falla,
  id,
  ok,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Permiso,
} from "@app/nucleo";
import type { Resultado } from "@app/nucleo";
import { limpiarClase } from "../dominio/clase.ts";
import { cambioDeHorario } from "../dominio/ocurrencias.ts";
import { GESTIONAR, VER } from "../dominio/permisos.ts";
import type {
  Clase,
  EdicionDeClase,
  ErrorDeAgenda,
  NuevaClase,
  Pagina,
  PaginaDe,
  RepositorioAgenda,
} from "./puertos.ts";

export const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const CLASE_INEXISTENTE = falla("clase-inexistente", "Esa clase no existe.");

export const puedeEn = (quien: ContextoCentro, permiso: Permiso, sedeId: string) =>
  puede(quien, permiso, id<"Sede">(sedeId));

/** Las clases de las sedes donde puede ver la agenda; con `sedeId`, solo esa. */
export async function listar(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId, ...pagina }: Pagina & { sedeId?: string },
): Promise<Resultado<PaginaDe<Clase>, ErrorDeAgenda>> {
  if (sedeId !== undefined && !puedeEn(quien, VER, sedeId)) return SIN_PERMISO;
  const sedeIds =
    sedeId === undefined
      ? sedesVisibles(quien).filter((sede) => puedeEn(quien, VER, sede))
      : [sedeId];
  return ok(await repo.clases({ ...pagina, sedeIds }));
}

export async function crear(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId, ...datos }: NuevaClase,
): Promise<Resultado<{ id: string }, ErrorDeAgenda>> {
  if (!puedeEn(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  const clase = limpiarClase(datos);
  if (!clase.ok) return clase;
  return ok(await repo.crearClase(sedeId, clase.valor));
}

/** La clase si existe y se puede gestionar en su sede. */
async function claseGestionable(repo: RepositorioAgenda, quien: ContextoCentro, claseId: string) {
  const clase = await repo.clase(claseId);
  if (clase === undefined) return CLASE_INEXISTENTE;
  return puedeEn(quien, GESTIONAR, clase.sedeId) ? ok(clase) : SIN_PERMISO;
}

/**
 * Compara la versión que vio quien edita (0013). Si cambia el horario, se mueven solo las fechas
 * futuras: las pasadas quedan como fueron.
 */
export async function editar(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { id: claseId, version, ...datos }: EdicionDeClase,
): Promise<Resultado<{ version: number }, ErrorDeAgenda>> {
  const actual = await claseGestionable(repo, quien, claseId);
  if (!actual.ok) return actual;
  const clase = limpiarClase(datos);
  if (!clase.ok) return clase;
  const nueva = await repo.actualizarClase(claseId, version, clase.valor);
  if (nueva === undefined) {
    return falla("cambio-concurrente", "Esta clase cambió mientras la editabas. Volvé a cargarla.");
  }
  const { dia, hora, duracionMinutos } = actual.valor;
  const mismoHorario =
    dia === clase.valor.dia &&
    hora === clase.valor.hora &&
    duracionMinutos === clase.valor.duracionMinutos;
  if (!mismoHorario) {
    const futuras = await repo.fechasFuturas(claseId, ahora);
    const plan = cambioDeHorario(futuras, clase.valor, await repo.zonaHoraria());
    await repo.moverFechas(plan.actualizar);
    await repo.borrarFechas(plan.borrar);
  }
  return ok({ version: nueva });
}

/** La baja no borra la clase ni sus fechas pasadas; las futuras dejan de existir. */
export async function fijarActiva(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { id: claseId, activa }: { id: string; activa: boolean },
): Promise<Resultado<null, ErrorDeAgenda>> {
  const clase = await claseGestionable(repo, quien, claseId);
  if (!clase.ok) return clase;
  await repo.fijarActiva(claseId, activa);
  if (!activa) {
    const futuras = await repo.fechasFuturas(claseId, ahora);
    await repo.borrarFechas(futuras.map((fecha) => fecha.id));
  }
  return ok(null);
}
