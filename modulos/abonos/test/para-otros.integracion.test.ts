// Lo que abonos les da a otros módulos (caja), sobre Postgres real: leer la cuota y registrar su
// pago una sola vez, dentro de la transacción del que cobra.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos, obtenerCuota, registrarPago, revertirPago } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

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
    nombre: "Libre",
    clasesPorSemana: 3,
    precio: 35_000,
  });
  if (!plan.ok) throw new Error(plan.error.mensaje);
  const alumnoId = await centro.alumno();
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
      periodo: "2026-11",
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
