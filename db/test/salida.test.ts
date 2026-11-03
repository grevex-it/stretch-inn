// Si un test falla, Vitest tiene que terminar con error aunque use el Postgres de prueba. Si no,
// el CI y el pre-push dan verde con tests rotos. Pasó: embedded-postgres registra async-exit-hook,
// que al terminar el proceso llama a process.exit(0) y pisa el código de error de Vitest.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";

const RAIZ_DB = join(import.meta.dirname, "..");
const VITEST = join(RAIZ_DB, "..", "node_modules", "vitest", "vitest.mjs");

it("un test que falla hace terminar a Vitest con error", () => {
  const corrida = spawnSync(
    process.execPath,
    [VITEST, "run", "--config", "test/fixtures/vitest.falla.config.ts"],
    { cwd: RAIZ_DB, encoding: "utf8", timeout: 120_000 },
  );
  expect(corrida.stdout + corrida.stderr).toContain("falla a propósito");
  expect(corrida.status).not.toBe(0);
}, 150_000);
