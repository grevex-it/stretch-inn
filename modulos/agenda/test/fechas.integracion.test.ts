// Fechas concretas sobre Postgres real: se arman a pedido sin efecto doble, siguen los cambios de
// horario solo hacia adelante, y se cancelan antes de empezar.
import { crearBase, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda } from "../src/index.ts";
import { centroConDosSedes, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const SEMANA = 7 * 86_400_000;
const PRIMERA = { pagina: 1, porPagina: 50 };
const proximoLunes = lunesDe(new Date(Date.now() + SEMANA));
const lunesPasado = lunesDe(new Date(Date.now() - SEMANA));

async function contarFechas(claseId: string): Promise<number> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<{ n: number }>(
      "select count(*)::int as n from ocurrencias where clase_id = $1",
      [claseId],
    );
    return rows[0]?.n ?? 0;
  } finally {
    await cliente.end();
  }
}

async function conClase(ahora?: () => Date) {
  const agenda = crearAgenda(base, ahora === undefined ? {} : { ahora });
  const centro = await centroConDosSedes(base, { norte: TODO, sur: [] });
  const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, sedeId: centro.norte });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  const semana = async (desde = proximoLunes) => {
    const resultado = await agenda.semana(centro.ctx, { ...PRIMERA, sedeId: centro.norte, desde });
    if (!resultado.ok) throw new Error(resultado.error.mensaje);
    return resultado.valor;
  };
  return { agenda, ...centro, claseId: creada.valor.id, semana };
}

describe("semana", () => {
  it("arma la fecha de cada clase en la zona del centro, una sola vez", async () => {
    const { claseId, semana } = await conClase();
    const primera = await semana();
    await semana();

    expect(primera.total).toBe(1);
    expect(primera.elementos[0]).toMatchObject({
      claseId,
      nombre: "Stretching",
      cupo: 12,
      fecha: proximoLunes,
      empiezaEn: new Date(`${proximoLunes}T21:30:00.000Z`),
      cancelada: false,
    });
    expect(await contarFechas(claseId)).toBe(1);
  });

  it("no inventa fechas anteriores al alta de la clase", async () => {
    const { semana } = await conClase();
    expect((await semana(lunesPasado)).total).toBe(0);
  });

  it("sin agenda en la sede, no la ve", async () => {
    const agenda = crearAgenda(base);
    const { ctx, sur } = await centroConDosSedes(base, { norte: TODO, sur: ["personas.ver"] });
    expect(
      await agenda.semana(ctx, { ...PRIMERA, sedeId: sur, desde: proximoLunes }),
    ).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
  });
});

describe("cambios de horario", () => {
  it("cambiar la hora mueve las fechas futuras", async () => {
    const { agenda, ctx, claseId, semana } = await conClase();
    await semana();
    await agenda.editarClase(ctx, { ...STRETCHING, id: claseId, version: 1, hora: "19:00" });

    const [fecha] = (await semana()).elementos;
    expect(fecha?.empiezaEn).toEqual(new Date(`${proximoLunes}T22:00:00.000Z`));
    expect(await contarFechas(claseId)).toBe(1);
  });

  it("cambiar el día borra las futuras y las vuelve a armar en el día nuevo", async () => {
    const { agenda, ctx, claseId, semana } = await conClase();
    await semana();
    await agenda.editarClase(ctx, { ...STRETCHING, id: claseId, version: 1, dia: 3 });

    const fechas = (await semana()).elementos.map((f) => f.fecha);
    const miercoles = new Date(Date.parse(`${proximoLunes}T00:00:00Z`) + 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(fechas).toEqual([miercoles]);
    expect(await contarFechas(claseId)).toBe(1);
  });

  it("dar de baja borra las fechas futuras; reactivar las vuelve a armar", async () => {
    const { agenda, ctx, claseId, semana } = await conClase();
    await semana();
    await agenda.fijarActiva(ctx, { id: claseId, activa: false });
    expect((await semana()).total).toBe(0);

    await agenda.fijarActiva(ctx, { id: claseId, activa: true });
    expect((await semana()).total).toBe(1);
  });
});

describe("cancelar una fecha", () => {
  it("queda marcada antes de que empiece, y se puede deshacer", async () => {
    const { agenda, ctx, semana } = await conClase();
    const [fecha] = (await semana()).elementos;
    if (fecha === undefined) throw new Error("sin fecha");

    expect(await agenda.fijarCancelada(ctx, { id: fecha.id, cancelada: true })).toEqual({
      ok: true,
      valor: null,
    });
    expect((await semana()).elementos[0]?.cancelada).toBe(true);
    await agenda.fijarCancelada(ctx, { id: fecha.id, cancelada: false });
    expect((await semana()).elementos[0]?.cancelada).toBe(false);
  });

  it("una fecha que ya empezó no se cambia", async () => {
    const enUnMes = () => new Date(Date.now() + 4 * SEMANA);
    const { agenda, ctx, semana } = await conClase(enUnMes);
    const [fecha] = (await semana()).elementos;
    if (fecha === undefined) throw new Error("sin fecha");
    expect(await agenda.fijarCancelada(ctx, { id: fecha.id, cancelada: true })).toMatchObject({
      ok: false,
      error: { codigo: "fecha-pasada" },
    });
  });
});
