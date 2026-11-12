// Lo que abonos les da a otros módulos, sobre Postgres real: leer la cuota y registrar su pago una
// sola vez, dentro de la transacción del que cobra (caja), y el fin del abono (asistencia, 0019).
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  crearAbonos,
  finDelAbono,
  obtenerCuota,
  registrarPago,
  revertirPago,
} from "../src/index.ts";
import { centroConDosSedes, conHorario } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const abonos = () => crearAbonos(base, { ahora: () => new Date("2026-11-15T12:00:00Z") });

async function conCuota() {
  const centro = await centroConDosSedes(base);
  const plan = await abonos().crearPlan(centro.ctx, {
    nombre: "Abono de 4 clases",
    clases: 4,
    precio: 35_000,
  });
  if (!plan.ok) throw new Error(plan.error.mensaje);
  const alumnoId = await centro.alumno();
  await conHorario(base, centro.ctx, { sedeId: centro.norte, alumnoId, dias: [1] });
  const cuota = await abonos().generarCuota(centro.ctx, {
    alumnoId,
    planId: plan.valor.id,
    sedeId: centro.norte,
  });
  if (!cuota.ok) throw new Error(cuota.error.mensaje);
  return { ...centro, alumnoId, cuotaId: cuota.valor.id };
}

describe("revertirPago", () => {
  it("anular el pago en caja deja la cuota sin pagar; con otro pago, no hace nada", async () => {
    const { ctx, cuotaId } = await conCuota();
    const pagoId = randomUUID();
    await enContexto(base, ctx, (tx) => registrarPago(tx, { cuotaId, pagoId, en: new Date() }));

    await enContexto(base, ctx, (tx) => revertirPago(tx, { cuotaId, pagoId: randomUUID() }));
    expect(
      (await enContexto(base, ctx, (tx) => obtenerCuota(tx, cuotaId)))?.pagadaEn,
    ).toBeInstanceOf(Date);
    await enContexto(base, ctx, (tx) => revertirPago(tx, { cuotaId, pagoId }));
    expect((await enContexto(base, ctx, (tx) => obtenerCuota(tx, cuotaId)))?.pagadaEn).toBeNull();
  });
});

describe("obtenerCuota y registrarPago", () => {
  it("lee la cuota; el pago la marca pagada una sola vez", async () => {
    const { ctx, norte, alumnoId, cuotaId } = await conCuota();
    expect(await enContexto(base, ctx, (tx) => obtenerCuota(tx, cuotaId))).toMatchObject({
      id: cuotaId,
      alumnoId,
      sedeId: norte,
      desde: "2026-11-15",
      clases: 4,
      monto: 35_000,
      pagadaEn: null,
    });

    const pago = { cuotaId, pagoId: randomUUID(), en: new Date() };
    expect(await enContexto(base, ctx, (tx) => registrarPago(tx, pago))).toEqual({
      ok: true,
      valor: null,
    });
    expect(
      await enContexto(base, ctx, (tx) => registrarPago(tx, { ...pago, pagoId: randomUUID() })),
    ).toMatchObject({ ok: false, error: { codigo: "cuota-pagada" } });
    const pagada = await enContexto(base, ctx, (tx) => obtenerCuota(tx, cuotaId));
    expect(pagada?.pagadaEn).toBeInstanceOf(Date);
  });

  it("una cuota anulada o de otro centro no existe para cobrar", async () => {
    const { ctx, cuotaId } = await conCuota();
    const otro = await centroConDosSedes(base);
    expect(await enContexto(base, otro.ctx, (tx) => obtenerCuota(tx, cuotaId))).toBeUndefined();
    await abonos().anularCuota(ctx, { id: cuotaId });
    expect(
      await enContexto(base, ctx, (tx) =>
        registrarPago(tx, { cuotaId, pagoId: randomUUID(), en: new Date() }),
      ),
    ).toMatchObject({ ok: false, error: { codigo: "cuota-inexistente" } });
  });
});

describe("finDelAbono", () => {
  const en = (instante: string) => new Date(instante);

  it("es el final de la última clase del abono vigente en ese momento", async () => {
    const { ctx, norte, alumnoId } = await conCuota();
    const fin = (instante: string, sedeId = norte) =>
      enContexto(base, ctx, (tx) => finDelAbono(tx, { alumnoId, sedeId, en: en(instante) }));
    // Abono desde el 15/11 con clase los lunes a las 18:30 de Buenos Aires (21:30 UTC, una hora):
    // 16/11, 23/11, 30/11 y 7/12. La última termina el 7/12 a las 22:30 UTC.
    expect(await fin("2026-11-20T21:00:00Z")).toEqual(en("2026-12-07T22:30:00Z"));
    expect(await fin("2026-12-07T22:29:00Z")).toEqual(en("2026-12-07T22:30:00Z"));
    expect(await fin("2026-12-07T22:30:00Z")).toBeUndefined();
    expect(await fin("2026-11-15T02:59:00Z")).toBeUndefined();
  });

  it("sin cuota en esa sede, o con la cuota anulada, no hay abono", async () => {
    const { ctx, sur, norte, alumnoId, cuotaId } = await conCuota();
    const momento = en("2026-11-20T21:00:00Z");
    const fin = (sedeId: string) =>
      enContexto(base, ctx, (tx) => finDelAbono(tx, { alumnoId, sedeId, en: momento }));
    expect(await fin(sur)).toBeUndefined();
    await abonos().anularCuota(ctx, { id: cuotaId });
    expect(await fin(norte)).toBeUndefined();
  });
});
