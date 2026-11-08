// Recuperaciones sobre Postgres real: reservar con un crédito, los lugares de la fecha, anular,
// el aviso cuyo lugar ya se ocupó y el último lugar disputado por dos a la vez.
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

/** El reloj tres horas antes de la fecha del lunes: los avisos dan crédito. */
async function conCredito() {
  const datos = await claseConFecha(base);
  const asistencia = crearAsistencia(base, {
    ahora: () => new Date(datos.fecha.empiezaEn.getTime() - 3 * HORA),
  });
  const avisar = async (alumnoId: string) => {
    const aviso = await asistencia.avisar(datos.ctx, { fechaId: datos.fecha.id, alumnoId });
    if (!aviso.ok || !aviso.valor.conCredito) throw new Error("El aviso no dio crédito.");
    return aviso.valor.id;
  };
  return { ...datos, asistencia, avisar };
}

describe("recuperar", () => {
  it("reserva con el crédito: figura en la planilla, ocupa un lugar y se le toma asistencia", async () => {
    const { ctx, ana, asistencia, avisar, otraClase } = await conCredito();
    await avisar(ana);
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
    const creditos = await asistencia.creditos(ctx, { ...PRIMERA, alumnoId: ana });
    expect(creditos.ok && creditos.valor.total).toBe(0);

    const enYoga = crearAsistencia(base, { ahora: () => yoga.fecha.empiezaEn });
    expect(
      await enYoga.tomar(ctx, {
        fechaId: yoga.fecha.id,
        marcas: [{ alumnoId: ana, estado: "presente" }],
      }),
    ).toEqual({ ok: true, valor: null });
  });

  it("sin crédito no recupera; en su propia clase tampoco; dos veces en la misma fecha, no", async () => {
    const { ctx, ana, bea, fecha, asistencia, avisar, otraClase } = await conCredito();
    const yoga = await otraClase(5, 0);
    expect(
      await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: bea }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-creditos" } });
    await avisar(ana);
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
    const { ctx, ana, asistencia, avisar, otraClase } = await conCredito();
    await avisar(ana);
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

  it("anular la recuperación devuelve el crédito; el aviso de un crédito usado no se anula", async () => {
    const { ctx, ana, asistencia, avisar, otraClase } = await conCredito();
    const avisoId = await avisar(ana);
    const yoga = await otraClase(2, 0);
    const reserva = await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana });
    if (!reserva.ok) throw new Error(reserva.error.mensaje);

    expect(await asistencia.anularAviso(ctx, { id: avisoId })).toMatchObject({
      ok: false,
      error: { codigo: "credito-usado" },
    });
    expect(await asistencia.anularRecuperacion(ctx, reserva.valor)).toEqual({
      ok: true,
      valor: null,
    });
    expect(await asistencia.anularRecuperacion(ctx, reserva.valor)).toMatchObject({
      ok: false,
      error: { codigo: "recuperacion-inexistente" },
    });
    const creditos = await asistencia.creditos(ctx, { ...PRIMERA, alumnoId: ana });
    expect(creditos.ok && creditos.valor.total).toBe(1);
  });

  it("recuperar pide asistencia.recuperar en la sede de la fecha", async () => {
    const { ana, asistencia, avisar, otraClase, otra } = await conCredito();
    await avisar(ana);
    const yoga = await otraClase(2, 0);
    const soloVe = await otra(["asistencia.ver"]);
    expect(
      await asistencia.recuperar(soloVe, { fechaId: yoga.fecha.id, alumnoId: ana }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});

describe("el último lugar", () => {
  it("dos reservas a la vez por el último lugar: entra una sola, la otra espera y ve que no hay", async () => {
    const { ctx, ana, bea, asistencia, avisar, otraClase } = await conCredito();
    await avisar(ana);
    await avisar(bea);
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
