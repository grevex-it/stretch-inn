// Ediciones simultáneas sobre Postgres real: el índice único del documento es la última barrera
// (0013) y su choque se responde como una regla, no como un error interno.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, editarAlumno } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

/** Una señal entre dos tareas: una la da y la otra espera a que llegue. */
function senal(): { dar: () => void; llego: Promise<void> } {
  const resolvedores: (() => void)[] = [];
  const llego = new Promise<void>((resolver) => {
    resolvedores.push(resolver);
  });
  return {
    dar: () => {
      for (const resolver of resolvedores) resolver();
    },
    llego,
  };
}

/** Espera a que alguna consulta de esta base quede frenada por un bloqueo. */
async function hastaQueEspereUnBloqueo(): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    for (let intento = 0; intento < 200; intento++) {
      const { rows } = await cliente.query<{ esperando: number }>(
        `select count(*)::int as esperando from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock'`,
      );
      if ((rows[0]?.esperando ?? 0) > 0) return;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    throw new Error("La edición nunca quedó esperando el índice del documento.");
  } finally {
    await cliente.end();
  }
}

describe("documento repetido en ediciones simultáneas", () => {
  it("si otro carga el mismo documento a la vez, la edición avisa en vez de fallar", async () => {
    const ctx = await contextoConPermisos(base, ["personas.ver", "personas.editar"]);
    const creado = await enContexto(base, ctx, (tx) => crearAlumno(tx, ANA));
    if (!creado.ok) throw new Error(creado.error.mensaje);
    const { id } = creado.valor;

    // Otra persona da de alta a alguien con ese documento y todavía no confirmó: la edición no
    // lo ve al revisar, y queda esperando en el índice único hasta que el alta se confirme.
    const altaEscrita = senal();
    const confirmarAlta = senal();
    const alta = enContexto(base, ctx, async (tx) => {
      await crearAlumno(tx, { ...ANA, nombre: "Otra", documento: "30123456" });
      altaEscrita.dar();
      await confirmarAlta.llego;
    });
    await altaEscrita.llego;

    const edicion = enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, id, version: 1, documento: "30.123.456" }),
    );
    await hastaQueEspereUnBloqueo();
    confirmarAlta.dar();
    await alta;

    await expect(edicion).resolves.toMatchObject({
      ok: false,
      error: { codigo: "documento-repetido" },
    });
  });
});
