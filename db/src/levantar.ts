// Levanta un Postgres real en local, sin Docker ni permisos de administrador.
// Uso: pnpm db:levantar (queda corriendo; Ctrl+C lo detiene). Los datos quedan en db/.datos/.
import { existsSync } from "node:fs";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const POR_DEFECTO = "postgres://postgres:clave@localhost:5432/stretch_inn";
const url = new URL(process.env["DATABASE_URL_MIGRACIONES"] ?? POR_DEFECTO);
const baseDeDatos = url.pathname.slice(1);
const carpetaDatos = join(import.meta.dirname, "..", ".datos");

const postgres = new EmbeddedPostgres({
  databaseDir: carpetaDatos,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  onLog: () => undefined,
});

async function crearBaseSiFalta(): Promise<void> {
  const servidor = new URL(url);
  servidor.pathname = "/postgres";
  const cliente = new pg.Client({ connectionString: servidor.toString() });
  await cliente.connect();
  const existe = await cliente.query("select 1 from pg_database where datname = $1", [baseDeDatos]);
  await cliente.end();
  if (existe.rowCount === 0) await postgres.createDatabase(baseDeDatos);
}

if (!existsSync(carpetaDatos)) {
  console.log("Primera vez: inicializando Postgres en db/.datos/ …");
  await postgres.initialise();
}
try {
  await postgres.start();
} catch (error) {
  console.error(
    `No se pudo arrancar Postgres en el puerto ${url.port || 5432}. ¿Quedó otro corriendo?\n` +
      "En Windows: taskkill /IM postgres.exe /F (cierra los Postgres de este usuario).",
  );
  console.error(error);
  process.exit(1);
}
await crearBaseSiFalta();
console.log(`Postgres listo en ${url.host}, base "${baseDeDatos}". Ctrl+C para detenerlo.`);

function detener(): void {
  void postgres.stop().then(() => {
    console.log("Postgres detenido.");
    process.exit(0);
  });
}
for (const senal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) process.on(senal, detener);
