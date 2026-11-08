import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Postgres real y descartable, con las migraciones aplicadas (ver db/AGENTS.md).
    globalSetup: ["@app/db/pruebas"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
