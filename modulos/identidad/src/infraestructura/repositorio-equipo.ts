// Repositorio del equipo sobre Drizzle. Corre dentro de enContexto: RLS limita al centro y a las
// sedes visibles. Cuentas y permisos en otras sedes pasan por funciones de alcance mínimo (0017).
import type { Permiso } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RepositorioEquipo } from "../aplicacion/puertos-equipo.ts";
import type { FilaDePermiso } from "../aplicacion/puertos.ts";
import { asignaciones, permisosDeRol, roles, sesiones, usuarios } from "./esquema.ts";

type LecturasDelEquipo = Pick<
  RepositorioEquipo,
  "usuarios" | "asignacionesDe" | "emailsDe" | "usuario"
>;
type LecturasDePermisos = Pick<RepositorioEquipo, "roles" | "permisosDeRol" | "permisosDeUsuario">;
type Escrituras = Omit<RepositorioEquipo, keyof LecturasDelEquipo | keyof LecturasDePermisos>;

const centroActual = sql`app_centro_actual()`;
const arreglo = (ids: readonly string[]) => sql`${`{${ids.join(",")}}`}::uuid[]`;

export function repositorioEquipo(tx: Transaccion): RepositorioEquipo {
  return { ...lecturasDelEquipo(tx), ...lecturasDePermisos(tx), ...escrituras(tx) };
}

function lecturasDelEquipo(tx: Transaccion): LecturasDelEquipo {
  return {
    async usuarios({ pagina, porPagina }) {
      const [elementos, [total]] = await Promise.all([
        tx
          .select({ id: usuarios.id, nombre: usuarios.nombre, activo: usuarios.activo })
          .from(usuarios)
          .orderBy(asc(usuarios.nombre), asc(usuarios.id))
          .limit(porPagina)
          .offset((pagina - 1) * porPagina),
        tx.select({ total: count() }).from(usuarios),
      ]);
      return { pagina, porPagina, elementos, total: total?.total ?? 0 };
    },
    async asignacionesDe(usuarioIds) {
      if (usuarioIds.length === 0) return [];
      return tx
        .select({
          usuarioId: asignaciones.usuarioId,
          sedeId: asignaciones.sedeId,
          rolId: asignaciones.rolId,
          rol: roles.nombre,
        })
        .from(asignaciones)
        .innerJoin(roles, eq(roles.id, asignaciones.rolId))
        .where(inArray(asignaciones.usuarioId, [...usuarioIds]))
        .orderBy(asc(asignaciones.sedeId), asc(roles.nombre));
    },
    async emailsDe(usuarioIds) {
      if (usuarioIds.length === 0) return new Map();
      const filas = await tx.execute<{ usuario_id: string; email: string }>(
        sql`select usuario_id, email from identidad_emails_de_usuarios(${arreglo(usuarioIds)})`,
      );
      return new Map(filas.rows.map((f) => [f.usuario_id, f.email]));
    },
    async usuario(usuarioId) {
      const [fila] = await tx
        .select({ cuentaId: usuarios.cuentaId, activo: usuarios.activo })
        .from(usuarios)
        .where(eq(usuarios.id, usuarioId));
      return fila;
    },
  };
}

function lecturasDePermisos(tx: Transaccion): LecturasDePermisos {
  return {
    async roles({ pagina, porPagina }) {
      const [elementos, [total]] = await Promise.all([
        tx
          .select({ id: roles.id, nombre: roles.nombre })
          .from(roles)
          .orderBy(asc(roles.nombre), asc(roles.id))
          .limit(porPagina)
          .offset((pagina - 1) * porPagina),
        tx.select({ total: count() }).from(roles),
      ]);
      return { pagina, porPagina, elementos, total: total?.total ?? 0 };
    },
    async permisosDeRol(rolId) {
      const existe = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, rolId));
      if (existe.length === 0) return undefined;
      const filas = await tx
        .select({ permiso: permisosDeRol.permiso })
        .from(permisosDeRol)
        .where(eq(permisosDeRol.rolId, rolId));
      return filas.map((fila) => fila.permiso as Permiso);
    },
    async permisosDeUsuario(usuarioId): Promise<FilaDePermiso[]> {
      const filas = await tx.execute<{
        sede_id: string;
        permiso: Permiso;
        origen: FilaDePermiso["origen"];
      }>(sql`select sede_id, permiso, origen from identidad_permisos_de_usuario(${usuarioId})`);
      return filas.rows.map((f) => ({ sedeId: f.sede_id, permiso: f.permiso, origen: f.origen }));
    },
  };
}

function escrituras(tx: Transaccion): Escrituras {
  return {
    async cuentaParaAlta(email, hashClave) {
      const filas = await tx.execute<{ cuenta_id: string; nueva: boolean }>(
        sql`select cuenta_id, nueva from identidad_cuenta_para_alta(${email}, ${hashClave})`,
      );
      const [fila] = filas.rows;
      if (fila === undefined) throw new Error("No se pudo obtener la cuenta del alta.");
      return { cuentaId: fila.cuenta_id, nueva: fila.nueva };
    },
    async crearUsuario({ cuentaId, nombre }) {
      const [fila] = await tx
        .insert(usuarios)
        .values({ cuentaId, nombre, centroId: centroActual })
        .onConflictDoNothing({ target: [usuarios.centroId, usuarios.cuentaId] })
        .returning({ id: usuarios.id });
      return fila?.id;
    },
    async asignar(usuarioId, sedeIds, rolId) {
      await tx
        .insert(asignaciones)
        .values(sedeIds.map((sedeId) => ({ usuarioId, sedeId, rolId, centroId: centroActual })))
        .onConflictDoNothing();
    },
    async resetearClave(usuarioId, hashClave) {
      const filas = await tx.execute<{ resultado: "ok" | "inexistente" | "otros-centros" }>(
        sql`select identidad_resetear_clave(${usuarioId}, ${hashClave}) as resultado`,
      );
      return filas.rows[0]?.resultado ?? "inexistente";
    },
    async fijarActivo(usuarioId, activo) {
      await tx
        .update(usuarios)
        .set({ activo, version: sql`${usuarios.version} + 1` })
        .where(eq(usuarios.id, usuarioId));
    },
    async revocarSesionesDeCuenta(cuentaId, ahora) {
      await tx
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(and(eq(sesiones.cuentaId, cuentaId), isNull(sesiones.revocadaEn)));
    },
    async revocarSesionesDeUsuario(usuarioId, ahora) {
      await tx
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(and(eq(sesiones.usuarioId, usuarioId), isNull(sesiones.revocadaEn)));
    },
  };
}
