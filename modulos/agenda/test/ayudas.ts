// Datos de prueba: un centro con dos sedes (Norte y Sur) y una persona que entra de verdad, con
// permisos distintos en cada una. El contexto sale de una sesión real (regla 1 de AGENTS.md).
import type {} from "@app/db/pruebas";
import { crearAcceso, hashearClave } from "@app/identidad";
import type { ContextoCentro } from "@app/nucleo";
import type { Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";

const CLAVE = "una clave bien larga";

export const TODO = ["agenda.ver", "agenda.gestionar", "agenda.inscribir"];

export async function comoDueno(consulta: string, valores: unknown[] = []): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    await cliente.query(consulta, valores);
  } finally {
    await cliente.end();
  }
}

async function rolCon(centro: string, permisos: readonly string[]): Promise<string> {
  const rol = randomUUID();
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, $3)", [
    rol,
    centro,
    `Rol ${rol}`,
  ]);
  for (const permiso of permisos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [centro, rol, permiso]);
  }
  return rol;
}

export interface CentroDePrueba {
  ctx: ContextoCentro;
  norte: string;
  sur: string;
}

/** Permisos en cada sede: sin permisos en una sede, la persona no la ve. */
export async function centroConDosSedes(
  base: Base,
  permisos: { norte: readonly string[]; sur: readonly string[] },
): Promise<CentroDePrueba> {
  const [centro, norte, sur, cuenta, usuario] = [1, 2, 3, 4, 5].map(() => randomUUID()) as [
    string,
    string,
    string,
    string,
    string,
  ];
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno(
    "insert into sedes (id, centro_id, nombre) values ($1, $3, 'Norte'), ($2, $3, 'Sur')",
    [norte, sur, centro],
  );
  const email = `${cuenta}@prueba.com`;
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, $3, false)",
    [cuenta, email, await hashearClave(CLAVE)],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Ana')",
    [usuario, centro, cuenta],
  );
  for (const [sede, propios] of [
    [norte, permisos.norte],
    [sur, permisos.sur],
  ] as const) {
    if (propios.length === 0) continue;
    const rol = await rolCon(centro, propios);
    await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [
      centro,
      usuario,
      sede,
      rol,
    ]);
  }
  const acceso = crearAcceso(base);
  const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: randomUUID() });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const sesion = await acceso.resolver(ingreso.valor.token);
  if (sesion?.centro == null) throw new Error("La sesión no quedó en el centro.");
  return { ctx: sesion.centro.contexto, norte, sur };
}

export const STRETCHING = {
  nombre: "Stretching",
  dia: 1,
  hora: "18:30",
  duracionMinutos: 60,
  cupo: 12,
};

/** El lunes de la semana de esa fecha, AAAA-MM-DD (en UTC: alcanza para los tests). */
export function lunesDe(instante: Date): string {
  const dia = instante.getUTCDay() || 7;
  return new Date(instante.getTime() - (dia - 1) * 86_400_000).toISOString().slice(0, 10);
}
