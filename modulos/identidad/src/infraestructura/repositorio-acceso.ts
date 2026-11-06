// Repositorio del login y las sesiones (ver docs/decisiones/0017). Cuentas y sesiones son datos
// de la plataforma, previos a elegir centro: se leen sin contexto. Lo de un centro pasa por las
// funciones de alcance mínimo o por enContexto.
import type { Permiso } from "@app/nucleo";
import { enContexto, type Base } from "@app/plataforma";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type {
  CentroDeCuenta,
  CuentaGuardada,
  RepositorioAcceso,
  SesionGuardada,
} from "../aplicacion/puertos-acceso.ts";
import type { FilaDePermiso } from "../aplicacion/puertos.ts";
import { cuentas, sesiones, usuarios } from "./esquema.ts";

type Cuentas = Pick<RepositorioAcceso, "cuentaPorEmail" | "cuentaPorId" | "cambiarClave">;
type Sesiones = Omit<
  RepositorioAcceso,
  keyof Cuentas | "centrosDe" | "permisosDe" | "recordarSede"
>;

const columnasDeCuenta = {
  id: cuentas.id,
  hashClave: cuentas.hashClave,
  debeCambiarClave: cuentas.debeCambiarClave,
};

export function repositorioAcceso(base: Base): RepositorioAcceso {
  return {
    ...repositorioDeCuentas(base),
    ...repositorioDeSesiones(base),
    async centrosDe(cuentaId): Promise<CentroDeCuenta[]> {
      const filas = await base.db.execute<{
        centro_id: string;
        nombre: string;
        usuario_id: string;
        ultima_sede_id: string | null;
      }>(
        sql`select centro_id, nombre, usuario_id, ultima_sede_id from identidad_centros_de(${cuentaId})`,
      );
      return filas.rows.map((f) => ({
        centroId: f.centro_id,
        nombre: f.nombre,
        usuarioId: f.usuario_id,
        ultimaSedeId: f.ultima_sede_id,
      }));
    },
    // Misma función de alcance mínimo que usa cargarPermisos: no necesita contexto.
    async permisosDe(cuentaId, centroId): Promise<FilaDePermiso[]> {
      const filas = await base.db.execute<{
        sede_id: string;
        permiso: Permiso;
        origen: FilaDePermiso["origen"];
      }>(sql`select sede_id, permiso, origen from identidad_permisos_de(${cuentaId}, ${centroId})`);
      return filas.rows.map((f) => ({ sedeId: f.sede_id, permiso: f.permiso, origen: f.origen }));
    },
    async recordarSede(contexto, usuarioId, sedeId) {
      await enContexto(base, contexto, (tx) =>
        tx.update(usuarios).set({ ultimaSedeId: sedeId }).where(eq(usuarios.id, usuarioId)),
      );
    },
  };
}

function repositorioDeCuentas({ db }: Base): Cuentas {
  return {
    async cuentaPorEmail(email): Promise<CuentaGuardada | undefined> {
      const [cuenta] = await db
        .select(columnasDeCuenta)
        .from(cuentas)
        .where(sql`lower(${cuentas.email}) = lower(${email})`);
      return cuenta;
    },
    async cuentaPorId(cuentaId) {
      const [cuenta] = await db
        .select(columnasDeCuenta)
        .from(cuentas)
        .where(eq(cuentas.id, cuentaId));
      return cuenta;
    },
    async cambiarClave(cuentaId, hashClave) {
      await db
        .update(cuentas)
        .set({ hashClave, debeCambiarClave: false, version: sql`${cuentas.version} + 1` })
        .where(eq(cuentas.id, cuentaId));
    },
  };
}

function repositorioDeSesiones({ db }: Base): Sesiones {
  const vigente = (sesionId: string) => and(eq(sesiones.id, sesionId), isNull(sesiones.revocadaEn));
  return {
    async crearSesion({ hashToken, cuentaId, ahora }) {
      const [fila] = await db
        .insert(sesiones)
        .values({ hashToken, cuentaId, creadaEn: ahora, ultimoUsoEn: ahora })
        .returning({ id: sesiones.id });
      if (fila === undefined) throw new Error("No se pudo crear la sesión.");
      return fila.id;
    },
    async sesionPorToken(hashToken): Promise<SesionGuardada | undefined> {
      const [fila] = await db
        .select({
          id: sesiones.id,
          cuentaId: sesiones.cuentaId,
          centroId: sesiones.centroId,
          usuarioId: sesiones.usuarioId,
          sedeActivaId: sesiones.sedeActivaId,
          creadaEn: sesiones.creadaEn,
          ultimoUsoEn: sesiones.ultimoUsoEn,
          debeCambiarClave: cuentas.debeCambiarClave,
        })
        .from(sesiones)
        .innerJoin(cuentas, eq(cuentas.id, sesiones.cuentaId))
        .where(and(eq(sesiones.hashToken, hashToken), isNull(sesiones.revocadaEn)));
      return fila;
    },
    async marcarUso(sesionId, ahora) {
      await db.update(sesiones).set({ ultimoUsoEn: ahora }).where(vigente(sesionId));
    },
    async fijarCentro(sesionId, { centroId, usuarioId, sedeActivaId }) {
      await db.update(sesiones).set({ centroId, usuarioId, sedeActivaId }).where(vigente(sesionId));
    },
    async fijarSede(sesionId, sedeActivaId) {
      await db.update(sesiones).set({ sedeActivaId }).where(vigente(sesionId));
    },
    async revocar(sesionId, ahora) {
      await db.update(sesiones).set({ revocadaEn: ahora }).where(vigente(sesionId));
    },
    async revocarOtras(cuentaId, salvo, ahora) {
      await db
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(
          and(eq(sesiones.cuentaId, cuentaId), ne(sesiones.id, salvo), isNull(sesiones.revocadaEn)),
        );
    },
  };
}
