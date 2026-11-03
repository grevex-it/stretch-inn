// Aplica las migraciones con la conexión del dueño del esquema y le pone a app_usuario la
// clave de DATABASE_URL. La clave nunca está en el repo (ver docs/decisiones/0002).
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export interface OpcionesMigrar {
  /** Dueño del esquema (DATABASE_URL_MIGRACIONES). */
  urlDueno: string;
  /** Conexión de la app (DATABASE_URL), con el rol app_usuario. */
  urlApp: string;
}

const CARPETA_MIGRACIONES = join(import.meta.dirname, "..", "migraciones");

async function fijarClaveApp(cliente: pg.Client, urlApp: string): Promise<void> {
  const url = new URL(urlApp);
  const usuario = decodeURIComponent(url.username);
  if (usuario !== "app_usuario") {
    throw new Error(`DATABASE_URL tiene que usar el rol app_usuario, no "${usuario}".`);
  }
  const clave = cliente.escapeLiteral(decodeURIComponent(url.password));
  await cliente.query(`alter role app_usuario password ${clave}`);
}

export async function migrar({ urlDueno, urlApp }: OpcionesMigrar): Promise<void> {
  const cliente = new pg.Client({ connectionString: urlDueno });
  await cliente.connect();
  try {
    // Si dos procesos migran a la vez (dos deploys), el segundo espera al primero.
    await cliente.query("select pg_advisory_lock(hashtext('app_migraciones'))");
    await migrate(drizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
    await fijarClaveApp(cliente, urlApp);
  } finally {
    await cliente.end();
  }
}
