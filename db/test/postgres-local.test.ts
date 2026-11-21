// PostgresLocal arranca el Postgres de pnpm db:levantar y de los tests. En Windows lo hace con
// pg_ctl para que funcione también con la sesión elevada (ver src/postgres-local.ts).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterEach, expect, it } from "vitest";
import { PostgresLocal } from "../src/postgres-local.ts";
import { puertoLibre } from "./puerto-libre.ts";

const CLAVE = "clave-local";
const carpetas: string[] = [];

async function nuevo(flags: string[] = []): Promise<{ postgres: PostgresLocal; puerto: number }> {
  const carpeta = mkdtempSync(join(tmpdir(), "postgres-local-"));
  carpetas.push(carpeta);
  const puerto = await puertoLibre();
  const postgres = new PostgresLocal({
    databaseDir: carpeta,
    user: "postgres",
    password: CLAVE,
    port: puerto,
    persistent: true,
    postgresFlags: flags,
  });
  await postgres.initialise();
  return { postgres, puerto };
}

afterEach(() => {
  for (const carpeta of carpetas.splice(0)) {
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  }
});

it("arranca, crea una base, acepta conexiones y se detiene", async () => {
  const { postgres, puerto } = await nuevo();
  await postgres.start();
  await postgres.createDatabase("una_base");
  const url = `postgres://postgres:${CLAVE}@localhost:${puerto}/una_base`;
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  const fila = await cliente.query<{ uno: number }>("select 1 as uno");
  await cliente.end();
  expect(fila.rows[0]?.uno).toBe(1);

  await postgres.stop();
  await expect(new pg.Client({ connectionString: url }).connect()).rejects.toThrow();
}, 120_000);

it("si Postgres no arranca, el error trae lo que dijo Postgres", async () => {
  const { postgres } = await nuevo(["-c", "parametro_que_no_existe=1"]);
  // Sin rejects.toThrow: Vitest lo da por bueno si se rechaza con undefined, que es justo el error.
  const error: unknown = await postgres.start().then(
    () => "arrancó",
    (motivo: unknown) => motivo,
  );
  expect(error).toBeInstanceOf(Error);
  expect(error instanceof Error ? error.message : "").toMatch(/parametro_que_no_existe/);
}, 120_000);
