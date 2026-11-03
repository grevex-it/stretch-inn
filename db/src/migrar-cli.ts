// Uso: pnpm db:migrar. Lee DATABASE_URL_MIGRACIONES y DATABASE_URL del entorno (o del .env).
import { migrar } from "./migrar.ts";

const urlDueno = process.env["DATABASE_URL_MIGRACIONES"];
const urlApp = process.env["DATABASE_URL"];
if (urlDueno === undefined || urlApp === undefined) {
  console.error("Faltan DATABASE_URL_MIGRACIONES y DATABASE_URL. Copiá .env.example a .env.");
  process.exit(1);
}
await migrar({ urlDueno, urlApp, urlLogs: process.env["LOGS_DATABASE_URL"] });
console.log("Migraciones aplicadas.");
