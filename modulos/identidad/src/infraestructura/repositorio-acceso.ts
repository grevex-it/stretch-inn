// Repositorio del login y las sesiones (ver docs/decisiones/0017). Cuentas y sesiones son datos
// de la plataforma, previos a elegir centro: se usan sin contexto. Las cuentas y lo de un centro
// pasan por las funciones de alcance mínimo; lo demás del centro, por enContexto.
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
import { sesiones, usuarios } from "./esquema.ts";

type Cuentas = Pick<RepositorioAcceso, "cuentaPorEmail" | "cuentaPorId" | "cambiarClave">;
type Sesiones = Omit<
  RepositorioAcceso,
  keyof Cuentas | "centrosDe" | "nombresDeSedes" | "permisosDe" | "recordarSede"
>;

type FilaDeSesion = {
  id: string;
  cuenta_id: string;
  centro_id: string | null;
  usuario_id: string | null;
  sede_activa_id: string | null;
  creada_en: string | Date;
  ultimo_uso_en: string | Date;
  debe_cambiar_clave: boolean;
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
    async nombresDeSedes(cuentaId, centroId, sedeIds) {
      const filas = await base.db.execute<{ id: string; nombre: string }>(
        sql`select id, nombre from identidad_nombres_de_sedes(${cuentaId}, ${centroId}, ${`{${sedeIds.join(",")}}`}::uuid[])`,
      );
      return filas.rows;
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

type FilaDeCuenta = { id: string; hash_clave: string; debe_cambiar_clave: boolean };

function deCuenta(fila: FilaDeCuenta | undefined): CuentaGuardada | undefined {
  return (
    fila && { id: fila.id, hashClave: fila.hash_clave, debeCambiarClave: fila.debe_cambiar_clave }
  );
}

// Las cuentas son de toda la plataforma: la app no tiene permisos sobre la tabla y pasa por las
// funciones de alcance mínimo (0017).
function repositorioDeCuentas({ db }: Base): Cuentas {
  return {
    async cuentaPorEmail(email) {
      const filas = await db.execute<FilaDeCuenta>(
        sql`select id, hash_clave, debe_cambiar_clave from identidad_cuenta_por_email(${email})`,
      );
      return deCuenta(filas.rows[0]);
    },
    async cuentaPorId(cuentaId) {
      const filas = await db.execute<FilaDeCuenta>(
        sql`select id, hash_clave, debe_cambiar_clave from identidad_cuenta_por_id(${cuentaId})`,
      );
      return deCuenta(filas.rows[0]);
    },
    async cambiarClave(cuentaId, hashClave) {
      await db.execute(sql`select identidad_cambiar_clave(${cuentaId}, ${hashClave})`);
    },
  };
}

function deSesion(f: FilaDeSesion | undefined): SesionGuardada | undefined {
  return (
    f && {
      id: f.id,
      cuentaId: f.cuenta_id,
      centroId: f.centro_id,
      usuarioId: f.usuario_id,
      sedeActivaId: f.sede_activa_id,
      creadaEn: new Date(f.creada_en),
      ultimoUsoEn: new Date(f.ultimo_uso_en),
      debeCambiarClave: f.debe_cambiar_clave,
    }
  );
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
      const filas = await db.execute<FilaDeSesion>(
        sql`select * from identidad_sesion_por_token(${hashToken})`,
      );
      return deSesion(filas.rows[0]);
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
