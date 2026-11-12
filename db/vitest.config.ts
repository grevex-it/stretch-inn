import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/postgres-de-prueba.ts"],
    // Levantar Postgres la primera vez lleva unos segundos.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    // Los archivos comparten la base del global setup. En paralelo, logs.test.ts crea y borra una
    // tabla en public mientras aislamiento.test.ts revisa el catálogo, y el control falla a veces.
    fileParallelism: false,
  },
});
