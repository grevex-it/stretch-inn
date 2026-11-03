import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/postgres-de-prueba.ts"],
    // Levantar Postgres la primera vez lleva unos segundos.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
