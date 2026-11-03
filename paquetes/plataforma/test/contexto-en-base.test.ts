// enContexto fija el centro y las sedes del ContextoCentro en cada transacción (ver 0002).
// Trae la declaración de inject("urlDueno"/"urlApp") del Postgres de prueba.
import type {} from "@app/db/pruebas";
import { id, type ContextoCentro, type Permiso, type SedeId } from "@app/nucleo";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { falla, ok } from "@app/nucleo";
import {
  conPuntoDeGuardado,
  crearBase,
  enContexto,
  verificarRolSeguro,
  type Base,
} from "../src/index.ts";

const urlDueno = inject("urlDueno");
const urlApp = inject("urlApp");

const CENTRO_A = id<"Centro">("00000000-0000-4000-a000-00000000000a");
const CENTRO_B = id<"Centro">("00000000-0000-4000-a000-00000000000b");
const SEDE_A1 = id<"Sede">("00000000-0000-4000-b000-0000000000a1");
const SEDE_A2 = id<"Sede">("00000000-0000-4000-b000-0000000000a2");
const SEDE_B1 = id<"Sede">("00000000-0000-4000-b000-0000000000b1");

function contexto(centroId: typeof CENTRO_A, permisos: [SedeId, Permiso[]][]): ContextoCentro {
  return {
    centroId,
    actor: { tipo: "usuario", usuarioId: id<"Usuario">("usuario-1") },
    permisosPorSede: new Map(permisos.map(([sede, lista]) => [sede, new Set(lista)])),
  };
}

async function comoDueno(consulta: string, valores: unknown[] = []): Promise<void> {
  const cliente = new pg.Client({ connectionString: urlDueno });
  await cliente.connect();
  await cliente.query(consulta, valores);
  await cliente.end();
}

let base: Base;

beforeAll(async () => {
  await comoDueno(`
    create table prueba_plataforma (id int primary key, centro_id uuid not null, sede_id uuid not null);
    alter table prueba_plataforma enable row level security;
    alter table prueba_plataforma force row level security;
    create policy aislamiento on prueba_plataforma
      using (centro_id = (select app_centro_actual())
             and sede_id = any ((select app_sedes_visibles())::uuid[]))
      with check (centro_id = (select app_centro_actual())
                  and sede_id = any ((select app_sedes_visibles())::uuid[]));`);
  await comoDueno("insert into prueba_plataforma values (1, $1, $2), (2, $1, $3), (3, $4, $5)", [
    CENTRO_A,
    SEDE_A1,
    SEDE_A2,
    CENTRO_B,
    SEDE_B1,
  ]);
  // Una sola conexión: así se ve si el contexto queda pegado a la conexión del pool.
  base = crearBase(urlApp, { maximoConexiones: 1 });
});

afterAll(async () => {
  await base.cerrar();
  await comoDueno("drop table prueba_plataforma");
});

async function idsVisibles(ctx: ContextoCentro): Promise<number[]> {
  return enContexto(base, ctx, async (tx) => {
    const filas = await tx.execute<{ id: number }>(
      sql`select id from prueba_plataforma order by id`,
    );
    return filas.rows.map((fila) => fila.id);
  });
}

describe("enContexto", () => {
  it("fija el centro y las sedes donde el actor tiene algún permiso", async () => {
    const ctx = contexto(CENTRO_A, [
      [SEDE_A1, ["caja.ver"]],
      [SEDE_A2, []],
    ]);
    const fijado = await enContexto(base, ctx, async (tx) => {
      const filas = await tx.execute<{ centro: string; sedes: string[] }>(
        sql`select app_centro_actual() as centro, app_sedes_visibles() as sedes`,
      );
      return filas.rows[0];
    });
    expect(fijado).toEqual({ centro: CENTRO_A, sedes: [SEDE_A1] });
  });

  it("deja que RLS filtre por centro y sede", async () => {
    expect(await idsVisibles(contexto(CENTRO_A, [[SEDE_A1, ["caja.ver"]]]))).toEqual([1]);
    expect(await idsVisibles(contexto(CENTRO_B, [[SEDE_B1, ["caja.ver"]]]))).toEqual([3]);
  });

  it("sin permisos en ninguna sede no ve nada, ni siquiera de su centro", async () => {
    expect(await idsVisibles(contexto(CENTRO_A, []))).toEqual([]);
  });

  it("no deja el contexto pegado a la conexión cuando termina", async () => {
    await idsVisibles(contexto(CENTRO_A, [[SEDE_A1, ["caja.ver"]]]));
    const filas = await base.db.execute<{ centro: string | null }>(
      sql`select app_centro_actual() as centro`,
    );
    expect(filas.rows[0]?.centro).toBeNull();
  });

  it("si el trabajo falla, deshace todo y propaga el error", async () => {
    const ctx = contexto(CENTRO_A, [[SEDE_A1, ["caja.cobrar"]]]);
    await expect(
      enContexto(base, ctx, async (tx) => {
        await tx.execute(sql`insert into prueba_plataforma values (4, ${CENTRO_A}, ${SEDE_A1})`);
        throw new Error("falla a propósito");
      }),
    ).rejects.toThrow("falla a propósito");
    expect(await idsVisibles(ctx)).toEqual([1]);
  });
});

describe("verificarRolSeguro", () => {
  it("acepta la conexión de app_usuario", async () => {
    await expect(verificarRolSeguro(base)).resolves.toBeUndefined();
  });

  it("rechaza un rol que saltea RLS, como el superusuario por defecto de Railway", async () => {
    const delDueno = crearBase(urlDueno);
    try {
      await expect(verificarRolSeguro(delDueno)).rejects.toThrow(/saltea RLS/);
    } finally {
      await delDueno.cerrar();
    }
  });
});

describe("conPuntoDeGuardado", () => {
  const ctx = () => contexto(CENTRO_A, [[SEDE_A1, ["caja.cobrar"]]]);
  const insertar = (tx: Parameters<Parameters<typeof enContexto>[2]>[0], fila: number) =>
    tx.execute(sql`insert into prueba_plataforma values (${fila}, ${CENTRO_A}, ${SEDE_A1})`);

  it("si el resultado es una falla, deshace lo del bloque y la transacción sigue", async () => {
    const despues = await enContexto(base, ctx(), async (tx) => {
      const resultado = await conPuntoDeGuardado(tx, async () => {
        await insertar(tx, 10);
        return falla("regla", "No se cumple la regla.");
      });
      expect(resultado.ok).toBe(false);
      await insertar(tx, 11);
      const filas = await tx.execute<{ id: number }>(
        sql`select id from prueba_plataforma where id >= 10 order by id`,
      );
      return filas.rows.map((fila) => fila.id);
    });
    expect(despues).toEqual([11]);
  });

  it("si el resultado es ok, conserva lo del bloque", async () => {
    await enContexto(base, ctx(), (tx) =>
      conPuntoDeGuardado(tx, async () => {
        await insertar(tx, 12);
        return ok(null);
      }),
    );
    expect(await idsVisibles(ctx())).toContain(12);
  });

  it("si el bloque tira un error, deshace lo del bloque y lo propaga", async () => {
    await expect(
      enContexto(base, ctx(), async (tx) => {
        await conPuntoDeGuardado(tx, async () => {
          await insertar(tx, 13);
          throw new Error("bug");
        });
      }),
    ).rejects.toThrow("bug");
    expect(await idsVisibles(ctx())).not.toContain(13);
  });
});
