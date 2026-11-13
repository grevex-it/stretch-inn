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
import { cupoEnCamas } from "../dominio/camas.ts";
import { limpiarClase, type DatosDeClase } from "../dominio/clase.ts";
import { cupoPosible, entraEnLasFechas } from "../dominio/inscripcion.ts";
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
export const PROFE_INVALIDO = falla(
  "profe-invalido",
  "Ese profe no es un integrante activo del equipo del centro.",
);

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

/** El profe de una clase: null (sin profe) o un usuario activo del centro. */
async function profeValido(
  repo: RepositorioAgenda,
  profeId: string | null,
): Promise<Resultado<string | null, ErrorDeAgenda>> {
  if (profeId === null || (await repo.profeValido(profeId))) return ok(profeId);
  return PROFE_INVALIDO;
}

export async function crear(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId, profeId, ...datos }: NuevaClase,
): Promise<Resultado<{ id: string }, ErrorDeAgenda>> {
  if (!puedeEn(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  const clase = limpiarClase(datos);
  if (!clase.ok) return clase;
  const enCamas = cupoEnCamas(clase.valor.cupo, await repo.camas(sedeId));
  if (!enCamas.ok) return enCamas;
  // Sin profe, el fijo de la sede (0022).
  const profe = await profeValido(
    repo,
    profeId ?? (profeId === null ? null : ((await repo.profeDeSede(sedeId)) ?? null)),
  );
  if (!profe.ok) return profe;
  return ok(await repo.crearClase(sedeId, clase.valor, profe.valor));
}

/**
 * La clase si existe y se puede gestionar en su sede. Queda bloqueada: una inscripción no se
 * cruza con un cambio de cupo.
 */
async function claseGestionable(repo: RepositorioAgenda, quien: ContextoCentro, claseId: string) {
  const clase = await repo.clase(claseId, true);
  if (clase === undefined) return CLASE_INEXISTENTE;
  return puedeEn(quien, GESTIONAR, clase.sedeId) ? ok(clase) : SIN_PERMISO;
}

/**
 * El cupo nuevo no deja afuera a los fijos, no pasa las camas de la sede y, si baja, no deja
 * afuera a las recuperaciones de una fecha futura.
 */
async function cupoNuevo(
  repo: RepositorioAgenda,
  ahora: Date,
  actual: Clase,
  cupo: number,
): Promise<Resultado<null, ErrorDeAgenda>> {
  const fijos = cupoPosible(cupo, actual.inscriptos);
  if (!fijos.ok) return fijos;
  const enCamas = cupoEnCamas(cupo, await repo.camas(actual.sedeId));
  if (!enCamas.ok || cupo >= actual.cupo) return enCamas;
  const masOcupada = await repo.masOcupadaFutura([actual.id], ahora);
  return entraEnLasFechas(cupo, actual.inscriptos, masOcupada);
}

/**
 * Compara la versión que vio quien edita (0013). Si cambia el horario, se mueven solo las fechas
 * futuras: las pasadas quedan como fueron.
 */
export async function editar(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { id: claseId, version, profeId, ...datos }: EdicionDeClase,
): Promise<Resultado<{ version: number }, ErrorDeAgenda>> {
  const actual = await claseGestionable(repo, quien, claseId);
  if (!actual.ok) return actual;
  const clase = limpiarClase(datos);
  if (!clase.ok) return clase;
  const cupo = await cupoNuevo(repo, ahora, actual.valor, clase.valor.cupo);
  if (!cupo.ok) return cupo;
  const profe = await cambioDeProfe(repo, ahora, actual.valor, profeId);
  if (!profe.ok) return profe;
  const nueva = await repo.actualizarClase(claseId, version, clase.valor, profeId);
  if (nueva === undefined) {
    return falla("cambio-concurrente", "Esta clase cambió mientras la editabas. Volvé a cargarla.");
  }
  await moverSiCambiaElHorario(repo, ahora, actual.valor, clase.valor);
  return ok({ version: nueva });
}

/**
 * Sin profe nuevo no cambia nada. Con otro, valida que sea un usuario activo y deja las fechas que
 * ya empezaron con el que tenían (0022).
 */
async function cambioDeProfe(
  repo: RepositorioAgenda,
  ahora: Date,
  actual: Clase,
  profeId: string | null | undefined,
): Promise<Resultado<null, ErrorDeAgenda>> {
  if (profeId === undefined || profeId === actual.profeId) return ok(null);
  const profe = await profeValido(repo, profeId);
  if (!profe.ok) return profe;
  await repo.congelarProfe(actual.id, actual.profeId, ahora);
  return ok(null);
}

/** Si cambia el horario, se mueven solo las fechas futuras: las pasadas quedan como fueron. */
async function moverSiCambiaElHorario(
  repo: RepositorioAgenda,
  ahora: Date,
  actual: Clase,
  clase: DatosDeClase,
): Promise<void> {
  const { dia, hora, duracionMinutos } = actual;
  if (dia === clase.dia && hora === clase.hora && duracionMinutos === clase.duracionMinutos) return;
  const futuras = await repo.fechasFuturas(actual.id, ahora);
  const plan = cambioDeHorario(futuras, clase, await repo.zonaHoraria());
  await repo.moverFechas(plan.actualizar);
  await repo.borrarFechas(plan.borrar);
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
