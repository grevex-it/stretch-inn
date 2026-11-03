// Reglas de permisos (ver docs/decisiones/0007 y 0017). Puras: sin base ni HTTP.
import type { Permiso, SedeId } from "@app/nucleo";

export type PermisosPorSede = ReadonlyMap<SedeId, ReadonlySet<Permiso>>;

/** Un rol asignado al usuario en una sede, con los permisos que tiene ese rol. */
export interface Asignacion {
  sedeId: SedeId;
  permisosDelRol: readonly Permiso[];
}

/** Ajuste individual de un usuario en una sede. */
export interface Ajuste {
  sedeId: SedeId;
  permiso: Permiso;
  tipo: "extra" | "quitado";
}

function enSede(mapa: Map<SedeId, Set<Permiso>>, sedeId: SedeId): Set<Permiso> {
  const existente = mapa.get(sedeId);
  if (existente !== undefined) return existente;
  const nuevo = new Set<Permiso>();
  mapa.set(sedeId, nuevo);
  return nuevo;
}

/** Roles de cada sede + extras − quitados. Si un permiso es extra y quitado, gana el quitado. */
export function permisosEfectivos(
  asignaciones: readonly Asignacion[],
  ajustes: readonly Ajuste[],
): PermisosPorSede {
  const resultado = new Map<SedeId, Set<Permiso>>();
  for (const { sedeId, permisosDelRol } of asignaciones) {
    const permisos = enSede(resultado, sedeId);
    for (const permiso of permisosDelRol) permisos.add(permiso);
  }
  for (const { sedeId, permiso } of ajustes.filter((ajuste) => ajuste.tipo === "extra")) {
    enSede(resultado, sedeId).add(permiso);
  }
  for (const { sedeId, permiso } of ajustes.filter((ajuste) => ajuste.tipo === "quitado")) {
    enSede(resultado, sedeId).delete(permiso);
  }
  return resultado;
}

/** Permisos que `quien` no tiene en esa sede: no los puede dar ahí (0007, regla 1). */
export function faltantesParaOtorgar(
  quien: PermisosPorSede,
  sedeId: SedeId,
  permisos: readonly Permiso[],
): Permiso[] {
  const propios = quien.get(sedeId);
  return permisos.filter((permiso) => propios?.has(permiso) !== true);
}

/** Permisos que `quien` no tiene en ninguna sede: no los puede poner en un rol. */
export function faltantesEnAlgunaSede(
  quien: PermisosPorSede,
  permisos: readonly Permiso[],
): Permiso[] {
  const enAlguna = new Set([...quien.values()].flatMap((lista) => [...lista]));
  return permisos.filter((permiso) => !enAlguna.has(permiso));
}

function cantidad(permisos: PermisosPorSede): number {
  return [...permisos.values()].reduce((total, lista) => total + lista.size, 0);
}

/**
 * Verdadero si `quien` tiene, en cada sede del objetivo, todos sus permisos, y en total al menos
 * uno más. Entre pares con los mismos permisos da falso (0017: reset de contraseña).
 */
export function tieneMenosPermisos(objetivo: PermisosPorSede, quien: PermisosPorSede): boolean {
  for (const [sedeId, permisos] of objetivo) {
    if (faltantesParaOtorgar(quien, sedeId, [...permisos]).length > 0) return false;
  }
  return cantidad(quien) > cantidad(objetivo);
}

/** Todos los permisos del catálogo en todas las sedes del centro (0007, regla 2). */
export function tieneAccesoTotal(
  efectivos: PermisosPorSede,
  catalogo: readonly Permiso[],
  sedes: readonly SedeId[],
): boolean {
  return sedes.every((sedeId) => faltantesParaOtorgar(efectivos, sedeId, catalogo).length === 0);
}
