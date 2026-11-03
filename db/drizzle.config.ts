// Configuración de drizzle-kit: genera las migraciones desde los esquemas de los módulos.
// Ver db/AGENTS.md.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/esquema.ts", "../modulos/*/src/infraestructura/esquema.ts"],
  out: "./migraciones",
  migrations: { prefix: "timestamp" },
  dbCredentials: {
    url: process.env["DATABASE_URL_MIGRACIONES"] ?? "",
  },
});
