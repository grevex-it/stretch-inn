// Esquema logs y rol logs_lector (ver docs/decisiones/0016): `pnpm logs` puede leer los logs de
// producción, pero nunca una tabla de los centros.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { migrar } from "../src/migrar.ts";

const urlDueno = inject("urlDueno");
const urlApp = inject("urlApp");
const urlLogs = inject("urlLogs");

async function consultar(url: string, sql: string): Promise<pg.QueryResultRow[]> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return (await cliente.query<pg.QueryResultRow>(sql)).rows;
  } finally {
    await cliente.end();
  }
}

beforeAll(async () => {
  await migrar({ urlDueno, urlApp, urlLogs });
  await consultar(urlDueno, "create table logs.prueba_log (id int, mensaje text)");
  await consultar(urlDueno, "insert into logs.prueba_log values (1, 'hola')");
  // Con RLS como toda tabla de centro: el test de aislamiento recorre esta misma base.
  await consultar(
    urlDueno,
    `create table dato_de_centro (id int, centro_id uuid);
     alter table dato_de_centro enable row level security;
     alter table dato_de_centro force row level security;
     create policy p on dato_de_centro using (centro_id = (select app_centro_actual()));`,
  );
});

afterAll(async () => {
  await consultar(urlDueno, "drop table logs.prueba_log; drop table dato_de_centro");
});

describe("logs_lector", () => {
  it("no es superusuario ni tiene BYPASSRLS", async () => {
    const filas = await consultar(
      urlDueno,
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'logs_lector'",
    );
    expect(filas).toEqual([{ rolsuper: false, rolbypassrls: false }]);
  });

  it("lee las tablas del esquema logs", async () => {
    expect(await consultar(urlLogs, "select mensaje from logs.prueba_log")).toEqual([
      { mensaje: "hola" },
    ]);
  });

  it("no puede escribir en los logs", async () => {
    await expect(consultar(urlLogs, "insert into logs.prueba_log values (2, 'x')")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("no puede leer tablas de los centros", async () => {
    await expect(consultar(urlLogs, "select * from dato_de_centro")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("app_usuario en el esquema logs", () => {
  it("escribe y lee logs", async () => {
    await consultar(urlApp, "insert into logs.prueba_log values (3, 'desde la app')");
    const filas = await consultar(urlApp, "select count(*)::int as cantidad from logs.prueba_log");
    expect(filas).toEqual([{ cantidad: 2 }]);
  });
});
