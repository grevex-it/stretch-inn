// Inscripciones fijas sobre Postgres real: el cupo nunca se supera, ni con dos a la vez por el
// último lugar (0013), y cada permiso se controla en la sede de la clase.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno, fijarActivo } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, type Agenda } from "../src/index.ts";
import { centroConDosSedes, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

let base: Base;
let agenda: Agenda;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  agenda = crearAgenda(base);
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const ALUMNOS = ["personas.ver", "personas.editar"];

async function alumno(ctx: ContextoCentro, nombre = "Ana") {
  const alta = await enContexto(base, ctx, (tx) =>
    crearAlumno(tx, {
      nombre,
      apellido: "Pérez",
      telefono: "11 5555-1234",
      documento: null,
      email: null,
      fechaNacimiento: null,
      notas: "",
    }),
  );
  if (!alta.ok) throw new Error(alta.error.mensaje);
  return alta.valor.id;
}

/**
 * Corre `pedidos` con la fila de la clase tomada por otra conexión (`for update`), espera a que
 * `cuantos` consultas queden frenadas por un bloqueo y recién entonces la suelta.
 */
async function conClaseTomada<T>(claseId: string, cuantos: number, pedidos: () => Promise<T>) {
  const duena = new pg.Client({ connectionString: inject("urlDueno") });
  await duena.connect();
  try {
    await duena.query("begin");
    await duena.query("select 1 from clases where id = $1 for update", [claseId]);
    const enCurso = pedidos();
    for (let intento = 0; intento < 400; intento++) {
      // Dentro de una transacción Postgres congela pg_stat_activity: hay que pedir una foto nueva.
      await duena.query("select pg_stat_clear_snapshot()");
      const { rows } = await duena.query<{ n: number }>(
        `select count(*)::int as n from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock'`,
      );
      if ((rows[0]?.n ?? 0) >= cuantos) break;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    await duena.query("commit");
    return await enCurso;
  } finally {
    await duena.end();
  }
}

async function conClase(cupo = 12, permisos = [...TODO, ...ALUMNOS]) {
  const centro = await centroConDosSedes(base, { norte: [...TODO, ...ALUMNOS], sur: [] });
  const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, cupo, sedeId: centro.norte });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  const claseId = creada.valor.id;
  const inscriptos = async () => {
    const lista = await agenda.clases(centro.ctx, PRIMERA);
    if (!lista.ok) throw new Error(lista.error.mensaje);
    return lista.valor.elementos.find((clase) => clase.id === claseId)?.inscriptos;
  };
  return { ...centro, claseId, inscriptos, permisos };
}

describe("inscribir", () => {
  it("ocupa un lugar en la clase y en cada fecha", async () => {
    const { ctx, norte, claseId, inscriptos } = await conClase();
    const resultado = await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(ctx) });

    expect(resultado.ok).toBe(true);
    expect(await inscriptos()).toBe(1);
    const desde = lunesDe(new Date(Date.now() + 7 * 86_400_000));
    const semana = await agenda.semana(ctx, { ...PRIMERA, sedeId: norte, desde });
    expect(semana).toMatchObject({ ok: true, valor: { elementos: [{ inscriptos: 1, cupo: 12 }] } });
  });

  it("el mismo alumno no se inscribe dos veces en la misma clase", async () => {
    const { ctx, claseId, inscriptos } = await conClase();
    const alumnoId = await alumno(ctx);
    await agenda.inscribir(ctx, { claseId, alumnoId });
    expect(await agenda.inscribir(ctx, { claseId, alumnoId })).toMatchObject({
      ok: false,
      error: { codigo: "ya-inscripto" },
    });
    expect(await inscriptos()).toBe(1);
  });

  it("con la clase completa avisa y no inscribe", async () => {
    const { ctx, claseId, inscriptos } = await conClase(1);
    await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(ctx) });
    expect(
      await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(ctx, "Bea") }),
    ).toMatchObject({ ok: false, error: { codigo: "clase-completa" } });
    expect(await inscriptos()).toBe(1);
  });

  it("varios a la vez por el último lugar: entra uno solo y el resto ve la clase completa", async () => {
    const { ctx, claseId, inscriptos } = await conClase(1);
    const alumnos: string[] = [];
    for (const nombre of ["Ana", "Bea", "Caro", "Dani", "Eli", "Fer", "Gabi", "Hugo"]) {
      alumnos.push(await alumno(ctx, nombre));
    }

    // Otra transacción tiene tomada la clase: los ocho pedidos quedan esperando y salen juntos.
    // Sin el bloqueo de la clase en inscribir, todos leerían el mismo lugar libre.
    const resultados = await conClaseTomada(claseId, alumnos.length, () =>
      Promise.all(alumnos.map((alumnoId) => agenda.inscribir(ctx, { claseId, alumnoId }))),
    );

    const codigos = resultados.map((r) => (r.ok ? "inscripto" : r.error.codigo));
    expect(codigos.filter((codigo) => codigo === "inscripto")).toHaveLength(1);
    expect(codigos.filter((codigo) => codigo !== "inscripto")).toEqual(
      Array.from({ length: 7 }, () => "clase-completa"),
    );
    expect(await inscriptos()).toBe(1);
  });

  it("un alumno de baja o de otro centro no se inscribe", async () => {
    const { ctx, claseId } = await conClase();
    const deBaja = await alumno(ctx);
    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: deBaja, activo: false }));
    expect(await agenda.inscribir(ctx, { claseId, alumnoId: deBaja })).toMatchObject({
      ok: false,
      error: { codigo: "alumno-de-baja" },
    });

    const otro = await centroConDosSedes(base, { norte: ALUMNOS, sur: [] });
    expect(
      await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(otro.ctx) }),
    ).toMatchObject({ ok: false, error: { codigo: "alumno-inexistente" } });
  });

  it("sin agenda.inscribir en la sede de la clase, no inscribe", async () => {
    const centro = await centroConDosSedes(base, {
      norte: ["agenda.ver", "agenda.gestionar", ...ALUMNOS],
      sur: [],
    });
    const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, sedeId: centro.norte });
    if (!creada.ok) throw new Error(creada.error.mensaje);
    const resultado = await agenda.inscribir(centro.ctx, {
      claseId: creada.valor.id,
      alumnoId: await alumno(centro.ctx),
    });
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});

describe("baja de una inscripción", () => {
  it("libera el lugar; después se puede volver a inscribir", async () => {
    const { ctx, claseId, inscriptos } = await conClase();
    const alumnoId = await alumno(ctx);
    const alta = await agenda.inscribir(ctx, { claseId, alumnoId });
    if (!alta.ok) throw new Error(alta.error.mensaje);

    expect(await agenda.darDeBajaInscripcion(ctx, { id: alta.valor.id })).toEqual({
      ok: true,
      valor: null,
    });
    expect(await inscriptos()).toBe(0);
    expect(await agenda.darDeBajaInscripcion(ctx, { id: alta.valor.id })).toMatchObject({
      ok: false,
      error: { codigo: "inscripcion-inexistente" },
    });
    expect((await agenda.inscribir(ctx, { claseId, alumnoId })).ok).toBe(true);
  });
});

describe("cupo e inscriptos", () => {
  it("el cupo no baja por debajo de los inscriptos", async () => {
    const { ctx, claseId } = await conClase(2);
    await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(ctx) });
    await agenda.inscribir(ctx, { claseId, alumnoId: await alumno(ctx, "Bea") });

    expect(
      await agenda.editarClase(ctx, { ...STRETCHING, id: claseId, version: 1, cupo: 1 }),
    ).toMatchObject({ ok: false, error: { codigo: "cupo-menor-que-inscriptos" } });
  });
});

describe("clases de un alumno", () => {
  it("lista sus inscripciones vigentes con los datos de cada clase", async () => {
    const { ctx, claseId } = await conClase();
    const alumnoId = await alumno(ctx);
    const alta = await agenda.inscribir(ctx, { claseId, alumnoId });
    if (!alta.ok) throw new Error(alta.error.mensaje);

    expect(await agenda.clasesDeAlumno(ctx, { ...PRIMERA, alumnoId })).toMatchObject({
      ok: true,
      valor: {
        total: 1,
        elementos: [
          { id: alta.valor.id, clase: { id: claseId, nombre: "Stretching", inscriptos: 1 } },
        ],
      },
    });
  });
});
