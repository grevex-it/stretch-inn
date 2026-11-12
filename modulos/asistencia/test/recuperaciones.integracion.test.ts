// Recuperaciones sobre Postgres real (0020): se recupera si hay lugar, sin aviso previo, dentro
// del abono vigente; cada sede fija la anticipación, el máximo por abono y si se puede recuperar
// sin abono. También los lugares de la fecha, anular y el último lugar disputado por dos a la vez.
import { crearBase, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia, type Asistencia } from "../src/index.ts";
import { claseConFecha } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const HORA = 60 * 60_000;
const DIA = 24 * HORA;

/**
 * El reloj tres horas antes de la fecha del lunes. Todos tienen un abono que empezó una semana
 * antes y termina tres semanas después, salvo que se pase otro.
 */
async function conAbono(abono: "vigente" | "sin abono" = "vigente") {
  const datos = await claseConFecha(base);
  const lunes = datos.fecha.empiezaEn.getTime();
  const vigente = { inicio: new Date(lunes - 7 * DIA), fin: new Date(lunes + 21 * DIA) };
  const asistencia = crearAsistencia(base, {
    ahora: () => new Date(lunes - 3 * HORA),
    abonoVigente: () => Promise.resolve(abono === "vigente" ? vigente : undefined),
  });
  const reglas = (cambios: {
    anticipacionMinutos?: number;
    maximoPorAbono?: number;
    sinAbono?: boolean;
  }) =>
    asistencia.fijarReglas(datos.ctx, {
      sedeId: datos.norte,
      anticipacionMinutos: 0,
      maximoPorAbono: 4,
      sinAbono: false,
      ...cambios,
    });
  return { ...datos, asistencia, reglas };
}

describe("recuperar", () => {
  it("sin aviso previo, si hay lugar: figura en la planilla, ocupa un lugar y se le toma asistencia", async () => {
    const { ctx, ana, asistencia, otraClase } = await conAbono();
    const yoga = await otraClase(2, 0);

    const reserva = await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana });
    expect(reserva.ok).toBe(true);

    const planilla = await asistencia.planilla(ctx, { ...PRIMERA, fechaId: yoga.fecha.id });
    if (!planilla.ok) throw new Error(planilla.error.mensaje);
    expect(planilla.valor.lugares).toBe(1);
    expect(planilla.valor.recuperan.elementos.map((r) => r.alumnoId)).toEqual([ana]);
    expect(planilla.valor.recuperan.elementos[0]?.recuperacionId).toBe(
      reserva.ok && reserva.valor.id,
    );

    const enYoga = crearAsistencia(base, { ahora: () => yoga.fecha.empiezaEn });
    expect(
      await enYoga.tomar(ctx, {
        fechaId: yoga.fecha.id,
        marcas: [{ alumnoId: ana, estado: "presente" }],
      }),
    ).toEqual({ ok: true, valor: null });
  });

  it("en su propia clase no recupera; dos veces en la misma fecha, tampoco", async () => {
    const { ctx, ana, fecha, asistencia, otraClase } = await conAbono();
    const yoga = await otraClase(5, 0);
    expect(await asistencia.recuperar(ctx, { fechaId: fecha.id, alumnoId: ana })).toMatchObject({
      ok: false,
      error: { codigo: "ya-inscripto" },
    });
    const pedido = { fechaId: yoga.fecha.id, alumnoId: ana };
    expect((await asistencia.recuperar(ctx, pedido)).ok).toBe(true);
    expect(await asistencia.recuperar(ctx, pedido)).toMatchObject({
      ok: false,
      error: { codigo: "ya-recupera" },
    });
  });

  it("sin lugar no entra; el aviso de un fijo libera uno; ese aviso ya no se puede anular", async () => {
    const { ctx, ana, asistencia, otraClase } = await conAbono();
    const yoga = await otraClase(1, 1);
    const pedido = { fechaId: yoga.fecha.id, alumnoId: ana };
    expect(await asistencia.recuperar(ctx, pedido)).toMatchObject({
      ok: false,
      error: { codigo: "sin-lugar" },
    });

    const fijo = yoga.alumnos[0] ?? "";
    const avisoDelFijo = await asistencia.avisar(ctx, { fechaId: yoga.fecha.id, alumnoId: fijo });
    if (!avisoDelFijo.ok) throw new Error(avisoDelFijo.error.mensaje);
    expect((await asistencia.recuperar(ctx, pedido)).ok).toBe(true);
    expect(await asistencia.anularAviso(ctx, avisoDelFijo.valor)).toMatchObject({
      ok: false,
      error: { codigo: "sin-lugar" },
    });
  });

  it("anular la recuperación libera el lugar, una sola vez", async () => {
    const { ctx, ana, asistencia, otraClase } = await conAbono();
    const yoga = await otraClase(1, 0);
    const reserva = await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana });
    if (!reserva.ok) throw new Error(reserva.error.mensaje);
    expect(await asistencia.anularRecuperacion(ctx, reserva.valor)).toEqual({
      ok: true,
      valor: null,
    });
    expect(await asistencia.anularRecuperacion(ctx, reserva.valor)).toMatchObject({
      ok: false,
      error: { codigo: "recuperacion-inexistente" },
    });
    const planilla = await asistencia.planilla(ctx, { ...PRIMERA, fechaId: yoga.fecha.id });
    expect(planilla.ok && planilla.valor.lugares).toBe(1);
  });

  it("recuperar pide asistencia.recuperar en la sede de la fecha", async () => {
    const { ana, asistencia, otraClase, otra } = await conAbono();
    const yoga = await otraClase(2, 0);
    const soloVe = await otra(["asistencia.ver"]);
    expect(
      await asistencia.recuperar(soloVe, { fechaId: yoga.fecha.id, alumnoId: ana }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});

describe("las reglas de la sede", () => {
  it("la anticipación: hay que anotarse con esa anticipación antes de la clase", async () => {
    const { ctx, ana, asistencia, otraClase, reglas } = await conAbono();
    const yoga = await otraClase(2, 0);
    // El reloj está tres horas antes del lunes; Yoga es el miércoles: faltan menos de 7 días.
    await reglas({ anticipacionMinutos: 7 * 24 * 60 });
    expect(
      await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana }),
    ).toMatchObject({ ok: false, error: { codigo: "fuera-de-tiempo" } });
    await reglas({ anticipacionMinutos: 60 });
    expect((await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana })).ok).toBe(
      true,
    );
  });

  it("el máximo por abono: cuenta las recuperaciones de ese abono", async () => {
    const { ctx, ana, asistencia, otraClase, reglas } = await conAbono();
    await reglas({ maximoPorAbono: 1 });
    const [yoga, pilates] = [await otraClase(2, 0), await otraClase(2, 0)];
    expect((await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana })).ok).toBe(
      true,
    );
    expect(
      await asistencia.recuperar(ctx, { fechaId: pilates.fecha.id, alumnoId: ana }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-recuperaciones" } });
  });

  it("sin abono vigente no recupera, salvo que la sede lo permita", async () => {
    const { ctx, ana, asistencia, otraClase, reglas } = await conAbono("sin abono");
    const yoga = await otraClase(2, 0);
    const pedido = { fechaId: yoga.fecha.id, alumnoId: ana };
    expect(await asistencia.recuperar(ctx, pedido)).toMatchObject({
      ok: false,
      error: { codigo: "sin-abono" },
    });
    await reglas({ sinAbono: true });
    expect((await asistencia.recuperar(ctx, pedido)).ok).toBe(true);
  });

  it("sin configurar, valen las de Río Tercero; cambiarlas pide asistencia.configurar", async () => {
    const { ctx, norte, asistencia, otra } = await conAbono();
    expect(await asistencia.reglas(ctx, { sedeId: norte })).toEqual({
      ok: true,
      valor: { anticipacionMinutos: 0, maximoPorAbono: 4, sinAbono: false },
    });
    const soloVe = await otra(["asistencia.ver"]);
    const mendoza = { sedeId: norte, anticipacionMinutos: 60, maximoPorAbono: 2, sinAbono: false };
    expect(await asistencia.fijarReglas(soloVe, mendoza)).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    expect(await asistencia.fijarReglas(ctx, { ...mendoza, maximoPorAbono: -1 })).toMatchObject({
      ok: false,
      error: { codigo: "reglas-invalidas" },
    });
    expect(await asistencia.fijarReglas(ctx, mendoza)).toEqual({ ok: true, valor: null });
    expect(await asistencia.reglas(soloVe, { sedeId: norte })).toEqual({
      ok: true,
      valor: { anticipacionMinutos: 60, maximoPorAbono: 2, sinAbono: false },
    });
  });
});

describe("el último lugar", () => {
  it("dos reservas a la vez por el último lugar: entra una sola, la otra espera y ve que no hay", async () => {
    const { ctx, ana, bea, asistencia, otraClase } = await conAbono();
    const yoga = await otraClase(1, 0);

    const resultados = await conFechaTomada(yoga.fecha.id, 2, () =>
      Promise.all([
        reservar(asistencia, ctx, yoga.fecha.id, ana),
        reservar(asistencia, ctx, yoga.fecha.id, bea),
      ]),
    );

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.find((r) => !r.ok)).toMatchObject({ error: { codigo: "sin-lugar" } });
  });
});

const reservar = (
  asistencia: Asistencia,
  ctx: Parameters<Asistencia["recuperar"]>[0],
  fechaId: string,
  alumnoId: string,
) => asistencia.recuperar(ctx, { fechaId, alumnoId });

/**
 * Otra conexión toma la fecha (el mismo bloqueo que usa asistencia), espera a que `esperando`
 * pedidos queden frenados en ese bloqueo y la suelta: así se superponen de verdad.
 */
async function conFechaTomada<T>(
  fechaId: string,
  esperando: number,
  correr: () => Promise<T>,
): Promise<T> {
  const tomador = new pg.Client({ connectionString: inject("urlDueno") });
  const mirador = new pg.Client({ connectionString: inject("urlDueno") });
  await Promise.all([tomador.connect(), mirador.connect()]);
  try {
    await tomador.query("begin");
    await tomador.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [fechaId]);
    const corriendo = correr();
    await hastaQueEsperen(mirador, esperando);
    await tomador.query("commit");
    return await corriendo;
  } finally {
    await Promise.all([tomador.end(), mirador.end()]);
  }
}

async function hastaQueEsperen(mirador: pg.Client, cuantos: number): Promise<void> {
  for (let intento = 0; intento < 200; intento++) {
    const { rows } = await mirador.query<{ total: string }>(
      `select count(*) as total from pg_stat_activity
        where wait_event_type = 'Lock' and wait_event = 'advisory'`,
    );
    if (Number(rows[0]?.total) >= cuantos) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  throw new Error(`No quedaron ${String(cuantos)} pedidos esperando el bloqueo de la fecha.`);
}
