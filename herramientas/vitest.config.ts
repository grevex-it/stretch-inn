import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Postgres real y descartable para el test de la semilla (ver db/AGENTS.md).
    globalSetup: ["@app/db/pruebas"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
