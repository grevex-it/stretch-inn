// Datos de prueba para los tests de acceso: centros, sedes, cuentas y roles cargados como dueño
// de la base, sin pasar por RLS.
import type {} from "@app/db/pruebas";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";
import { hashearClave } from "../src/infraestructura/claves.ts";

export const CLAVE = "una clave bien larga";

export async function comoDueno<Fila extends pg.QueryResultRow = pg.QueryResultRow>(
  consulta: string,
  valores: unknown[] = [],
): Promise<Fila[]> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    return (await cliente.query<Fila>(consulta, valores)).rows;
  } finally {
    await cliente.end();
  }
}

/** Un centro con las sedes pedidas y un rol con caja.ver. */
export async function centroConSedes(nombre: string, sedes: string[]) {
  const centroId = randomUUID();
  const rolId = randomUUID();
  const sedeIds = sedes.map(() => randomUUID());
  await comoDueno("insert into centros (id, nombre) values ($1, $2)", [centroId, nombre]);
  for (const [i, sede] of sedes.entries()) {
    await comoDueno("insert into sedes (id, centro_id, nombre) values ($1, $2, $3)", [
      sedeIds[i],
      centroId,
      sede,
    ]);
  }
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, 'Recepción')", [
    rolId,
    centroId,
  ]);
  await comoDueno("insert into permisos_de_rol values ($1, $2, 'caja.ver')", [centroId, rolId]);
  return { centroId, rolId, sedeIds };
}

/** Un rol del centro con esos permisos. */
export async function rolCon(centroId: string, nombre: string, permisos: string[]) {
  const rolId = randomUUID();
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, $3)", [
    rolId,
    centroId,
    nombre,
  ]);
  for (const permiso of permisos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [centroId, rolId, permiso]);
  }
  return rolId;
}

/** Una cuenta con clave conocida. El email es único por corrida. */
export async function cuenta(opciones: { debeCambiarClave?: boolean } = {}) {
  const cuentaId = randomUUID();
  const email = `${cuentaId}@prueba.com`;
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, $3, $4)",
    [cuentaId, email, await hashearClave(CLAVE), opciones.debeCambiarClave ?? false],
  );
  return { cuentaId, email };
}

/** Usuario de la cuenta en el centro, con el rol en las sedes indicadas. */
export async function usuario(
  cuentaId: string,
  centro: { centroId: string; rolId: string },
  sedeIds: string[],
): Promise<string> {
  const usuarioId = randomUUID();
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Ana')",
    [usuarioId, centro.centroId, cuentaId],
  );
  for (const sedeId of sedeIds) {
    await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [
      centro.centroId,
      usuarioId,
      sedeId,
      centro.rolId,
    ]);
  }
  return usuarioId;
}

/** Reloj de prueba que se adelanta a mano. */
export function relojDePrueba(inicio = new Date("2026-11-05T10:00:00Z")) {
  let ahora = inicio.getTime();
  return {
    ahora: () => new Date(ahora),
    adelantar: (ms: number) => {
      ahora += ms;
    },
  };
}
