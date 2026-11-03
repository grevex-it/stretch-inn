// Quién opera, en qué centro y con qué permisos en cada sede.
// Ver docs/decisiones/0002, 0007 y 0008.

declare const marcaId: unique symbol;

/** Identificador marcado: impide pasar el id de una sede donde va el de un centro. */
export type Id<Tipo extends string> = string & { readonly [marcaId]: Tipo };

export type CentroId = Id<"Centro">;
export type SedeId = Id<"Sede">;
export type UsuarioId = Id<"Usuario">;
export type OperadorId = Id<"Operador">;

export function id<Tipo extends string>(valor: string): Id<Tipo> {
  return valor as Id<Tipo>;
}

/** Permiso de la lista fija de cada módulo, ej. "caja.cobrar". */
export type Permiso = `${string}.${string}`;

/** Un usuario del centro o un operador de GREVEX entrando como soporte (0008). */
export type Actor =
  | { readonly tipo: "usuario"; readonly usuarioId: UsuarioId }
  | { readonly tipo: "soporte"; readonly operadorId: OperadorId };

export interface ContextoCentro {
  readonly centroId: CentroId;
  readonly actor: Actor;
  /** Permisos efectivos por sede, ya calculados por identidad. */
  readonly permisosPorSede: ReadonlyMap<SedeId, ReadonlySet<Permiso>>;
}

export function puede(ctx: ContextoCentro, permiso: Permiso, sedeId: SedeId): boolean {
  return ctx.permisosPorSede.get(sedeId)?.has(permiso) ?? false;
}

/** Sedes donde el actor tiene algún permiso: son las que RLS le deja ver. */
export function sedesVisibles(ctx: ContextoCentro): SedeId[] {
  return [...ctx.permisosPorSede]
    .filter(([, permisos]) => permisos.size > 0)
    .map(([sedeId]) => sedeId);
}
