// Casos de uso de los profes y sus tarifas (0024). El tipo de profe y las tarifas de todo el
// centro piden el permiso en alguna sede; las de una sede, en esa sede (0007).
import {
  falla,
  id,
  ok,
  pesos,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import { CONFIGURAR, VER } from "../dominio/permisos.ts";
import { esTipo, TIPO_POR_DEFECTO } from "../dominio/profe.ts";
import { vigenciaNueva } from "../dominio/tarifas.ts";
import type {
  Alcance,
  ErrorDeProfesores,
  Pagina,
  PaginaDe,
  Profe,
  RepositorioProfesores,
  TarifaGuardada,
} from "./puertos.ts";

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const PROFE_INVALIDO = falla(
  "profe-invalido",
  "Ese profe no es un integrante activo del equipo del centro.",
);

const enAlgunaSede = (quien: ContextoCentro, permiso: Permiso) =>
  sedesVisibles(quien).some((sede) => puede(quien, permiso, sede));
/** En la sede, si la tarifa es de una sede; en alguna, si es de todo el centro. */
const puedeEnAlcance = (quien: ContextoCentro, permiso: Permiso, sedeId: string | null) =>
  sedeId === null ? enAlgunaSede(quien, permiso) : puede(quien, permiso, id<"Sede">(sedeId));

export async function profes(
  repo: RepositorioProfesores,
  quien: ContextoCentro,
  pagina: Pagina,
): Promise<Resultado<PaginaDe<Profe>, ErrorDeProfesores>> {
  if (!enAlgunaSede(quien, VER)) return SIN_PERMISO;
  const equipo = await repo.equipo(pagina);
  const tipos = await repo.tipos(equipo.elementos.map((p) => p.id));
  return ok({
    ...equipo,
    elementos: equipo.elementos.map((p) => ({ ...p, tipo: tipos.get(p.id) ?? TIPO_POR_DEFECTO })),
  });
}

export async function fijarTipo(
  repo: RepositorioProfesores,
  quien: ContextoCentro,
  { profeId, tipo }: { profeId: string; tipo: string },
): Promise<Resultado<null, ErrorDeProfesores>> {
  if (!enAlgunaSede(quien, CONFIGURAR)) return SIN_PERMISO;
  if (!esTipo(tipo)) return falla("tipo-invalido", "El profe es empleado o socio.");
  if (!(await repo.profeValido(profeId))) return PROFE_INVALIDO;
  await repo.guardarTipo(profeId, tipo);
  return ok(null);
}

export async function tarifas(
  repo: RepositorioProfesores,
  quien: ContextoCentro,
  filtro: Pagina & { sedeId: string | null },
): Promise<Resultado<PaginaDe<TarifaGuardada>, ErrorDeProfesores>> {
  if (!puedeEnAlcance(quien, VER, filtro.sedeId)) return SIN_PERMISO;
  return ok(await repo.tarifas(filtro));
}

/**
 * Una tarifa nueva del alcance: rige desde `desde` y cierra la última abierta del mismo alcance el
 * día antes. Los cambios de un alcance van de a uno.
 */
export async function fijarTarifa(
  repo: RepositorioProfesores,
  quien: ContextoCentro,
  ahora: Date,
  { monto, desde, ...alcance }: Alcance & { monto: number; desde: string },
): Promise<Resultado<null, ErrorDeProfesores>> {
  if (!puedeEnAlcance(quien, CONFIGURAR, alcance.sedeId)) return SIN_PERMISO;
  if (alcance.profeId !== null && !(await repo.profeValido(alcance.profeId))) return PROFE_INVALIDO;
  await repo.bloquearAlcance(alcance);
  const anterior = await repo.ultimaAbierta(alcance);
  const vigencia = vigenciaNueva(anterior, { desde, monto }, await repo.hoy(ahora));
  if (!vigencia.ok) return vigencia;
  if (anterior !== undefined && vigencia.valor.cerrarAnteriorEl !== null) {
    await repo.cerrar(alcance, anterior.id, vigencia.valor.cerrarAnteriorEl);
  }
  await repo.guardarTarifa(alcance, { monto: pesos(monto), desde });
  return ok(null);
}
