// PagoRegistrado sobre Postgres real: el cobro lo publica en la misma transacción (outbox), una
// sola vez por pago; un cobro que no se confirma no publica nada (0003, 0013).
import { crearAbonos } from "@app/abonos";
import {
  crearBase,
  crearCola,
  crearLogger,
  declararTarea,
  type Base,
  type Cola,
} from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearCaja, EVENTO_PAGO_REGISTRADO, type PagoRegistrado } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
let cola: Cola;
beforeAll(async () => {
  base = crearBase(inject("urlApp"));
  cola = crearCola({ url: inject("urlApp"), logger: crearLogger({ nivel: "fatal" }) });
  await cola.iniciar();
  await declararTarea(cola, EVENTO_PAGO_REGISTRADO);
});
afterAll(async () => {
  await cola.detener();
  await base.cerrar();
});

const AHORA = new Date("2026-11-09T15:00:00Z");

async function eventos(): Promise<PagoRegistrado[]> {
  const trabajos = await cola.boss.fetch<PagoRegistrado>(EVENTO_PAGO_REGISTRADO, {
    batchSize: 50,
  });
  return trabajos.map((t) => t.data);
}

describe("PagoRegistrado", () => {
  it("el cobro publica el evento una sola vez, aunque el pedido se repita", async () => {
    const centro = await centroConDosSedes(base);
    const abonos = crearAbonos(base, { ahora: () => AHORA });
    const plan = await abonos.crearPlan(centro.ctx, {
      nombre: "Libre",
      clasesPorSemana: 3,
      precio: 35_000,
    });
    if (!plan.ok) throw new Error(plan.error.mensaje);
    const alumnoId = await centro.alumno();
    const cuota = await abonos.generarCuota(centro.ctx, {
      alumnoId,
      planId: plan.valor.id,
      sedeId: centro.norte,
    });
    if (!cuota.ok) throw new Error(cuota.error.mensaje);
    const caja = crearCaja(base, { ahora: () => AHORA, cola });
    const cobro = {
      cuotaId: cuota.valor.id,
      medio: "efectivo",
      claveIdempotencia: `c-${randomUUID()}`,
    };

    const pago = await caja.cobrarCuota(centro.ctx, cobro);
    if (!pago.ok) throw new Error(pago.error.mensaje);
    await caja.cobrarCuota(centro.ctx, cobro);
    await caja.cobrarCuota(centro.ctx, { ...cobro, claveIdempotencia: `c-${randomUUID()}` });

    const deEstePago = (await eventos()).filter((e) => e.cuotaId === cuota.valor.id);
    expect(deEstePago).toEqual([
      {
        pagoId: pago.valor.id,
        centroId: centro.ctx.centroId,
        sedeId: centro.norte,
        alumnoId,
        cuotaId: cuota.valor.id,
        monto: 35_000,
        medio: "efectivo",
        registradoEn: AHORA.toISOString(),
      },
    ]);
  });
});
