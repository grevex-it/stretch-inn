// Repositorio de los roles a medida y los permisos de cada integrante, sobre Drizzle. Corre dentro
// de enContexto: RLS limita al centro y a las sedes visibles. Lo que tiene que ver todas las sedes
// pasa por funciones de alcance mínimo (identidad_asignaciones_del_rol, identidad_es_protegido, …).
import type { Permiso } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, sql } from "drizzle-orm";
import type { AsignacionConPermisos, RepositorioRoles } from "../aplicacion/puertos-roles.ts";
import { ajustes, asignaciones, permisosDeRol, roles, usuarios } from "./esquema.ts";
import { repositorioEquipo } from "./repositorio-equipo.ts";
import { repositorioIdentidad } from "./repositorio.ts";

type Propias = Omit<RepositorioRoles, keyof ReturnType<typeof repositorioIdentidad>>;

const centroActual = sql`app_centro_actual()`;

export function repositorioRoles(tx: Transaccion): RepositorioRoles {
  return { ...repositorioIdentidad(tx), ...deRoles(tx), ...deIntegrantes(tx) };
}

async function permisosDe(tx: Transaccion, rolId: string): Promise<Permiso[]> {
  const filas = await tx
    .select({ permiso: permisosDeRol.permiso })
    .from(permisosDeRol)
    .where(eq(permisosDeRol.rolId, rolId))
    .orderBy(asc(permisosDeRol.permiso));
  return filas.map((fila) => fila.permiso as Permiso);
}

function deRoles(
  tx: Transaccion,
): Pick<Propias, "rol" | "editarRol" | "borrarRol" | "asignacionesDelRol"> {
  return {
    async rol(rolId) {
      const [fila] = await tx
        .select({
          id: roles.id,
          nombre: roles.nombre,
          plantilla: roles.plantilla,
          version: roles.version,
        })
        .from(roles)
        .where(eq(roles.id, rolId));
      return fila === undefined ? undefined : { ...fila, permisos: await permisosDe(tx, rolId) };
    },
    async editarRol({ id, nombre, permisos, version }) {
      const [editado] = await tx
        .update(roles)
        .set({ nombre, version: sql`${roles.version} + 1` })
        .where(and(eq(roles.id, id), eq(roles.version, version)))
        .returning({ version: roles.version });
      if (editado === undefined) return undefined;
      await tx.delete(permisosDeRol).where(eq(permisosDeRol.rolId, id));
      if (permisos.length > 0) {
        await tx
          .insert(permisosDeRol)
          .values(permisos.map((permiso) => ({ centroId: centroActual, rolId: id, permiso })));
      }
      return editado.version;
    },
    async borrarRol(rolId) {
      await tx.delete(roles).where(eq(roles.id, rolId));
    },
    async asignacionesDelRol(rolId) {
      const filas = await tx.execute<{ nombre: string; sede_id: string }>(
        sql`select nombre, sede_id from identidad_asignaciones_del_rol(${rolId})`,
      );
      return filas.rows.map((fila) => ({ nombre: fila.nombre, sedeId: fila.sede_id }));
    },
  };
}

/** Las asignaciones con los permisos de cada rol, de una sola consulta. */
function agrupar(
  filas: { sedeId: string; rolId: string; rol: string; permiso: string | null }[],
): AsignacionConPermisos[] {
  const porAsignacion = new Map<string, AsignacionConPermisos>();
  for (const { sedeId, rolId, rol, permiso } of filas) {
    const clave = `${sedeId} ${rolId}`;
    const asignacion = porAsignacion.get(clave) ?? { sedeId, rolId, rol, permisos: [] };
    if (permiso !== null) asignacion.permisos.push(permiso as Permiso);
    porAsignacion.set(clave, asignacion);
  }
  return [...porAsignacion.values()];
}

/** Sus roles con sus permisos y sus ajustes, en las sedes que ve quien consulta (RLS). */
async function rolesYAjustesDe(
  tx: Transaccion,
  usuarioId: string,
): ReturnType<RepositorioRoles["rolesYAjustesDe"]> {
  const [deRoles, propios] = await Promise.all([
    tx
      .select({
        sedeId: asignaciones.sedeId,
        rolId: asignaciones.rolId,
        rol: roles.nombre,
        permiso: permisosDeRol.permiso,
      })
      .from(asignaciones)
      .innerJoin(roles, eq(roles.id, asignaciones.rolId))
      .leftJoin(permisosDeRol, eq(permisosDeRol.rolId, asignaciones.rolId))
      .where(eq(asignaciones.usuarioId, usuarioId))
      .orderBy(asc(asignaciones.sedeId), asc(roles.nombre), asc(permisosDeRol.permiso)),
    tx
      .select({ sedeId: ajustes.sedeId, permiso: ajustes.permiso, tipo: ajustes.tipo })
      .from(ajustes)
      .where(eq(ajustes.usuarioId, usuarioId))
      .orderBy(asc(ajustes.sedeId), asc(ajustes.permiso)),
  ]);
  return {
    asignaciones: agrupar(deRoles),
    ajustes: propios.map((a) => ({
      sedeId: a.sedeId,
      permiso: a.permiso as Permiso,
      tipo: a.tipo === "extra" ? "extra" : "quitado",
    })),
  };
}

function deIntegrantes(
  tx: Transaccion,
): Pick<
  Propias,
  "existeUsuario" | "permisosDeUsuario" | "esProtegido" | "rolesYAjustesDe" | "quitarAjuste"
> {
  return {
    async existeUsuario(usuarioId) {
      const filas = await tx
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId));
      return filas.length > 0;
    },
    permisosDeUsuario: (usuarioId) => repositorioEquipo(tx).permisosDeUsuario(usuarioId),
    async esProtegido(usuarioId) {
      const filas = await tx.execute<{ protegido: boolean }>(
        sql`select identidad_es_protegido(${usuarioId}) as protegido`,
      );
      return filas.rows[0]?.protegido === true;
    },
    rolesYAjustesDe: (usuarioId) => rolesYAjustesDe(tx, usuarioId),
    async quitarAjuste({ usuarioId, sedeId, permiso }) {
      const quitados = await tx
        .delete(ajustes)
        .where(
          and(
            eq(ajustes.usuarioId, usuarioId),
            eq(ajustes.sedeId, sedeId),
            eq(ajustes.permiso, permiso),
          ),
        )
        .returning({ permiso: ajustes.permiso });
      return quitados.length > 0;
    },
  };
}
