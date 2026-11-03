// Aplica las migraciones con la conexión del dueño del esquema y les pone a los roles la clave
// de su URL (app_usuario: DATABASE_URL; logs_lector: LOGS_DATABASE_URL). Las claves nunca están
// en el repo (ver docs/decisiones/0002 y 0016).
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export interface OpcionesMigrar {
  /** Dueño del esquema (DATABASE_URL_MIGRACIONES). */
  urlDueno: string;
  /** Conexión de la app (DATABASE_URL), con el rol app_usuario. */
  urlApp: string;
  /** Conexión de `pnpm logs` (LOGS_DATABASE_URL), con el rol logs_lector. Opcional. */
  urlLogs?: string | undefined;
}

const CARPETA_MIGRACIONES = join(import.meta.dirname, "..", "migraciones");

async function fijarClave(cliente: pg.Client, urlRol: string, rol: string): Promise<void> {
  const url = new URL(urlRol);
  const usuario = decodeURIComponent(url.username);
  if (usuario !== rol) {
    throw new Error(`La conexión tiene que usar el rol ${rol}, no "${usuario}".`);
  }
  const clave = cliente.escapeLiteral(decodeURIComponent(url.password));
  await cliente.query(`alter role ${rol} password ${clave}`);
}

export async function migrar({ urlDueno, urlApp, urlLogs }: OpcionesMigrar): Promise<void> {
  const cliente = new pg.Client({ connectionString: urlDueno });
  await cliente.connect();
  try {
    // Si dos procesos migran a la vez (dos deploys), el segundo espera al primero.
    await cliente.query("select pg_advisory_lock(hashtext('app_migraciones'))");
    await migrate(drizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
    await fijarClave(cliente, urlApp, "app_usuario");
    if (urlLogs !== undefined) await fijarClave(cliente, urlLogs, "logs_lector");
  } finally {
    await cliente.end();
  }
}
