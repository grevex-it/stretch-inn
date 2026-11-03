import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/fixtures/falla.prueba.ts"],
    globalSetup: ["./test/postgres-de-prueba.ts"],
    hookTimeout: 60_000,
  },
});
