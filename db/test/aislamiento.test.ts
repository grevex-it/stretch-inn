// Test de aislamiento entre centros y sedes (ver docs/decisiones/0002).
// Recorre todas las tablas de los centros: las nuevas quedan cubiertas sin agregarlas a mano.
import pg from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { migrar } from "../src/migrar.ts";
import { politicasInseguras, tablasSinAislamiento } from "./control-aislamiento.ts";

const urlDueno = inject("urlDueno");
const urlApp = inject("urlApp");

const CENTRO_A = "00000000-0000-4000-a000-00000000000a";
const CENTRO_B = "00000000-0000-4000-a000-00000000000b";
const SEDE_A1 = "00000000-0000-4000-b000-0000000000a1";
const SEDE_A2 = "00000000-0000-4000-b000-0000000000a2";
const SEDE_B1 = "00000000-0000-4000-b000-0000000000b1";

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

describe("toda tabla de los centros", () => {
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

  it("el control detecta una tabla de public sin RLS aunque no tenga centro_id", async () => {
    await cliente.query("create table sin_centro_id (id int, nombre text)");
    expect(await tablasSinAislamiento(cliente)).toEqual(["public.sin_centro_id"]);
  });
});

async function tablaConRls(tabla: string, columnas: string): Promise<void> {
  await cliente.query(`create table ${tabla} (${columnas})`);
  await cliente.query(`alter table ${tabla} enable row level security`);
  await cliente.query(`alter table ${tabla} force row level security`);
}

describe("toda política de una tabla de centro (R4)", () => {
  it("aísla por centro en las tablas reales", async () => {
    expect(await politicasInseguras(cliente)).toEqual([]);
  });

  it("el control rechaza una política que deja ver todo", async () => {
    await tablaConRls("abierta", "id int, centro_id uuid");
    await cliente.query("create policy todo on abierta using (true) with check (true)");
    expect(await politicasInseguras(cliente)).toEqual([
      "public.abierta.todo: no filtra por app_centro_actual()",
    ]);
  });

  it("el control rechaza una política con OR, aunque mencione el centro", async () => {
    await tablaConRls("con_or", "id int, centro_id uuid");
    await cliente.query(
      "create policy p on con_or using (centro_id = (select app_centro_actual()) or id > 0)",
    );
    expect(await politicasInseguras(cliente)).toEqual([
      "public.con_or.p: usa OR, NOT o CASE: puede abrir más allá del centro",
    ]);
  });

  it("el control rechaza una escritura sin control de centro", async () => {
    await tablaConRls("escritura_abierta", "id int, centro_id uuid");
    await cliente.query("create policy p on escritura_abierta for insert with check (true)");
    expect(await politicasInseguras(cliente)).toEqual([
      "public.escritura_abierta.p: no filtra por app_centro_actual()",
    ]);
  });

  it("el control rechaza una tabla con sede_id cuya política no filtra por sede", async () => {
    await tablaConRls("solo_centro", "id int, centro_id uuid, sede_id uuid");
    await cliente.query(
      "create policy p on solo_centro using (centro_id = (select app_centro_actual()))",
    );
    expect(await politicasInseguras(cliente)).toEqual([
      "public.solo_centro.p: la tabla tiene sede_id y la política no filtra por sedes visibles",
    ]);
  });

  it("el control acepta la política estándar de db/AGENTS.md", async () => {
    await tablaConRls("estandar", "id int, centro_id uuid, sede_id uuid");
    await cliente.query(`
      create policy aislamiento on estandar
        using (centro_id = (select app_centro_actual())
               and sede_id = any ((select app_sedes_visibles())::uuid[]))
        with check (centro_id = (select app_centro_actual())
                    and sede_id = any ((select app_sedes_visibles())::uuid[]))`);
    expect(await politicasInseguras(cliente)).toEqual([]);
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
