// Test de aislamiento entre centros y sedes (ver docs/decisiones/0002).
// Recorre todas las tablas con centro_id: las tablas nuevas quedan cubiertas sin agregarlas a mano.
import pg from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { migrar } from "../src/migrar.ts";

const urlDueno = inject("urlDueno");
const urlApp = inject("urlApp");

const CENTRO_A = "00000000-0000-4000-a000-00000000000a";
const CENTRO_B = "00000000-0000-4000-a000-00000000000b";
const SEDE_A1 = "00000000-0000-4000-b000-0000000000a1";
const SEDE_A2 = "00000000-0000-4000-b000-0000000000a2";
const SEDE_B1 = "00000000-0000-4000-b000-0000000000b1";

/** Tablas con centro_id sin RLS activado, sin RLS forzado o sin ninguna política. */
const TABLAS_SIN_AISLAMIENTO = `
  select n.nspname || '.' || c.relname as tabla
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'centro_id' and not a.attisdropped
  where c.relkind in ('r', 'p')
    -- logs: datos de la plataforma; su centro_id es para filtrar, no para aislar (0016).
    and n.nspname not in ('pg_catalog', 'information_schema', 'drizzle', 'logs')
    and (not c.relrowsecurity or not c.relforcerowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid))
  order by 1`;

async function tablasSinAislamiento(cliente: pg.Client): Promise<string[]> {
  return (await cliente.query<{ tabla: string }>(TABLAS_SIN_AISLAMIENTO)).rows.map((f) => f.tabla);
}

let cliente: pg.Client;

beforeAll(async () => {
  await migrar({ urlDueno, urlApp });
});

beforeEach(async () => {
  cliente = new pg.Client({ connectionString: urlDueno });
  await cliente.connect();
  await cliente.query("begin");
});

afterEach(async () => {
  await cliente.query("rollback");
  await cliente.end();
});

describe("toda tabla con centro_id", () => {
  it("tiene RLS activado, forzado y con política", async () => {
    expect(await tablasSinAislamiento(cliente)).toEqual([]);
  });

  it("el control detecta una tabla sin RLS, o con RLS sin forzar", async () => {
    await cliente.query("create table sin_rls (id int, centro_id uuid)");
    await cliente.query("create table sin_forzar (id int, centro_id uuid)");
    await cliente.query("alter table sin_forzar enable row level security");
    await cliente.query("create policy p on sin_forzar using (true)");
    expect(await tablasSinAislamiento(cliente)).toEqual(["public.sin_forzar", "public.sin_rls"]);
  });
});

async function crearTablaAislada(): Promise<void> {
  await cliente.query(`
    create table prueba_aislada (
      id int primary key, centro_id uuid not null, sede_id uuid not null
    )`);
  await cliente.query("alter table prueba_aislada enable row level security");
  await cliente.query("alter table prueba_aislada force row level security");
  await cliente.query(`
    create policy aislamiento on prueba_aislada
      using (centro_id = (select app_centro_actual())
             and sede_id = any ((select app_sedes_visibles())::uuid[]))
      with check (centro_id = (select app_centro_actual())
                  and sede_id = any ((select app_sedes_visibles())::uuid[]))`);
  await cliente.query("insert into prueba_aislada values (1, $1, $2), (2, $1, $3), (3, $4, $5)", [
    CENTRO_A,
    SEDE_A1,
    SEDE_A2,
    CENTRO_B,
    SEDE_B1,
  ]);
  await cliente.query("set local role app_usuario");
}

async function fijarContexto(centro: string, sedes: string[]): Promise<void> {
  await cliente.query("select set_config('app.centro_id', $1, true)", [centro]);
  await cliente.query("select set_config('app.sedes', $1, true)", [`{${sedes.join(",")}}`]);
}

async function idsVisibles(): Promise<number[]> {
  const filas = await cliente.query<{ id: number }>("select id from prueba_aislada order by id");
  return filas.rows.map((fila) => fila.id);
}

describe("con la política estándar y conectado como app_usuario", () => {
  beforeEach(crearTablaAislada);

  it("sin contexto fijado no ve ninguna fila (falla cerrada)", async () => {
    expect(await idsVisibles()).toEqual([]);
  });

  it("ve solo las filas de su centro y de sus sedes", async () => {
    await fijarContexto(CENTRO_A, [SEDE_A1, SEDE_A2]);
    expect(await idsVisibles()).toEqual([1, 2]);
  });

  it("no ve una sede de su centro donde no tiene permisos", async () => {
    await fijarContexto(CENTRO_A, [SEDE_A1]);
    expect(await idsVisibles()).toEqual([1]);
  });

  it("no ve otro centro aunque nombre una sede de ese centro", async () => {
    await fijarContexto(CENTRO_A, [SEDE_A1, SEDE_B1]);
    expect(await idsVisibles()).toEqual([1]);
  });

  it("no puede escribir filas de otro centro", async () => {
    await fijarContexto(CENTRO_A, [SEDE_A1]);
    await expect(
      cliente.query("insert into prueba_aislada values (4, $1, $2)", [CENTRO_B, SEDE_B1]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("funciones de aislamiento", () => {
  it("son STABLE, para evaluarse una vez por consulta (0013)", async () => {
    const filas = await cliente.query<{ proname: string; provolatile: string }>(
      `select proname, provolatile from pg_proc
       where proname in ('app_centro_actual', 'app_sedes_visibles', 'app_puede_ver_sede')
       order by proname`,
    );
    expect(filas.rows).toEqual([
      { proname: "app_centro_actual", provolatile: "s" },
      { proname: "app_puede_ver_sede", provolatile: "s" },
      { proname: "app_sedes_visibles", provolatile: "s" },
    ]);
  });
});
