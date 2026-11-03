// Repositorio de identidad sobre Drizzle. Corre dentro de enContexto: RLS limita al centro y a
// las sedes visibles; las funciones de alcance mínimo son la única excepción (0017).
import type { Permiso } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, eq, sql } from "drizzle-orm";
import type {
  FilaDePermiso,
  FilaDePermisoDeUsuario,
  NuevaAsignacion,
  NuevoAjuste,
  RepositorioIdentidad,
} from "../aplicacion/puertos.ts";
import { ajustes, asignaciones, permisosDeRol, roles } from "./esquema.ts";

type FilaCruda = { sede_id: string; permiso: Permiso; origen: FilaDePermiso["origen"] };

type Lecturas = Pick<
  RepositorioIdentidad,
  "permisosDe" | "permisosDelCentro" | "sedesDelCentro" | "existeRolConNombre" | "permisosDeRol"
>;
type Escrituras = Omit<RepositorioIdentidad, keyof Lecturas>;

const centroActual = sql`app_centro_actual()`;

export function repositorioIdentidad(tx: Transaccion): RepositorioIdentidad {
  return { ...lecturas(tx), ...escrituras(tx) };
}

function lecturas(tx: Transaccion): Lecturas {
  return {
    async permisosDe(cuentaId, centroId) {
      const filas = await tx.execute<FilaCruda>(
        sql`select sede_id, permiso, origen from identidad_permisos_de(${cuentaId}, ${centroId})`,
      );
      return filas.rows.map((f) => ({ sedeId: f.sede_id, permiso: f.permiso, origen: f.origen }));
    },
    async permisosDelCentro(): Promise<FilaDePermisoDeUsuario[]> {
      const filas = await tx.execute<FilaCruda & { usuario_id: string }>(
        sql`select usuario_id, sede_id, permiso, origen from identidad_permisos_del_centro()`,
      );
      return filas.rows.map((f) => ({
        usuarioId: f.usuario_id,
        sedeId: f.sede_id,
        permiso: f.permiso,
        origen: f.origen,
      }));
    },
    async sedesDelCentro() {
      const filas = await tx.execute<{ id: string }>(
        sql`select identidad_sedes_del_centro() as id`,
      );
      return filas.rows.map((fila) => fila.id);
    },
    async existeRolConNombre(nombre) {
      const filas = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(sql`lower(${roles.nombre}) = lower(${nombre})`);
      return filas.length > 0;
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
  };
}

function escrituras(tx: Transaccion): Escrituras {
  return {
    async crearRol({ id, nombre, permisos }) {
      await tx.insert(roles).values({ id, nombre, centroId: centroActual });
      if (permisos.length === 0) return;
      await tx
        .insert(permisosDeRol)
        .values(permisos.map((permiso) => ({ centroId: centroActual, rolId: id, permiso })));
    },
    async asignar(asignacion: NuevaAsignacion) {
      await tx
        .insert(asignaciones)
        .values({ ...asignacion, centroId: centroActual })
        .onConflictDoNothing();
    },
    async quitarAsignacion({ usuarioId, sedeId, rolId }: NuevaAsignacion) {
      const quitadas = await tx
        .delete(asignaciones)
        .where(
          and(
            eq(asignaciones.usuarioId, usuarioId),
            eq(asignaciones.sedeId, sedeId),
            eq(asignaciones.rolId, rolId),
          ),
        )
        .returning({ rolId: asignaciones.rolId });
      return quitadas.length > 0;
    },
    async ajustar(ajuste: NuevoAjuste) {
      await tx
        .insert(ajustes)
        .values({ ...ajuste, centroId: centroActual })
        .onConflictDoUpdate({
          target: [ajustes.centroId, ajustes.usuarioId, ajustes.sedeId, ajustes.permiso],
          set: { tipo: ajuste.tipo },
        });
    },
  };
}
