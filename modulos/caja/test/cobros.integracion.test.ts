// Cobros sobre Postgres real: cobrar una cuota una sola vez con la clave de idempotencia, el pago
// y la cuota pagada juntos, anular con motivo, el día de caja y los permisos por sede.
import { crearAbonos } from "@app/abonos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearCaja } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const AHORA = new Date("2026-11-09T15:00:00Z");
const caja = () => crearCaja(base, { ahora: () => AHORA });
const abonos = () => crearAbonos(base, { ahora: () => AHORA });
const clave = () => `cobro-${randomUUID()}`;

async function cuotaDe(ctx: ContextoCentro, sedeId: string, alumnoId: string) {
  const plan = await abonos().crearPlan(ctx, {
    nombre: `Plan ${randomUUID()}`,
    clases: 4,
    precio: 30_000,
  });
  if (!plan.ok) throw new Error(plan.error.mensaje);
  const cuota = await abonos().generarCuota(ctx, { alumnoId, planId: plan.valor.id, sedeId });
  if (!cuota.ok) throw new Error(cuota.error.mensaje);
  return cuota.valor.id;
}

async function conCuota() {
  const centro = await centroConDosSedes(base);
  const alumnoId = await centro.alumno();
  return { ...centro, alumnoId, cuotaId: await cuotaDe(centro.ctx, centro.norte, alumnoId) };
}

async function pagadaEn(ctx: ContextoCentro, alumnoId: string) {
  const lista = await abonos().cuotasDeAlumno(ctx, { pagina: 1, porPagina: 50, alumnoId });
  return lista.ok ? lista.valor.elementos[0]?.pagadaEn : undefined;
}

async function pagosDeLaCuota(cuotaId: string): Promise<number> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  const { rows } = await cliente.query<{ total: string }>(
    "select count(*) as total from pagos where cuota_id = $1",
    [cuotaId],
  );
  await cliente.end();
  return Number(rows[0]?.total);
}

describe("cobrar una cuota", () => {
  it("cobra el monto de la cuota y la deja pagada; la misma clave no cobra dos veces", async () => {
    const { ctx, alumnoId, cuotaId } = await conCuota();
    const cobro = { cuotaId, medio: "efectivo", claveIdempotencia: clave() };

    const primero = await caja().cobrarCuota(ctx, cobro);
    expect(primero).toMatchObject({ ok: true, valor: { monto: 30_000, repetido: false } });
    expect(await pagadaEn(ctx, alumnoId)).toEqual(AHORA);

    const repetido = await caja().cobrarCuota(ctx, cobro);
    expect(repetido).toEqual({
      ok: true,
      valor: { id: primero.ok ? primero.valor.id : "", monto: 30_000, repetido: true },
    });
    expect(await caja().cobrarCuota(ctx, { ...cobro, claveIdempotencia: clave() })).toMatchObject({
      ok: false,
      error: { codigo: "cuota-pagada" },
    });
    expect(await pagosDeLaCuota(cuotaId)).toBe(1);
  });

  it("el doble clic: el mismo cobro dos veces a la vez deja un solo pago", async () => {
    const { ctx, cuotaId } = await conCuota();
    const cobro = { cuotaId, medio: "transferencia", claveIdempotencia: clave() };
    const [a, b] = await Promise.all([
      caja().cobrarCuota(ctx, cobro),
      caja().cobrarCuota(ctx, cobro),
    ]);
    expect(a.ok && b.ok && a.valor.id === b.valor.id).toBe(true);
    expect(await pagosDeLaCuota(cuotaId)).toBe(1);
  });

  it("rechaza medio desconocido, clave corta y una clave usada en otra cuota", async () => {
    const { ctx, norte, cuotaId, alumno } = await conCuota();
    for (const medio of ["cheque", "mercadopago"]) {
      expect(
        await caja().cobrarCuota(ctx, { cuotaId, medio, claveIdempotencia: clave() }),
      ).toMatchObject({ ok: false, error: { codigo: "medio-invalido" } });
    }
    expect(
      await caja().cobrarCuota(ctx, { cuotaId, medio: "efectivo", claveIdempotencia: "corta" }),
    ).toMatchObject({ ok: false, error: { codigo: "clave-invalida" } });

    const usada = clave();
    await caja().cobrarCuota(ctx, { cuotaId, medio: "efectivo", claveIdempotencia: usada });
    const otra = await cuotaDe(ctx, norte, await alumno("Bea"));
    expect(
      await caja().cobrarCuota(ctx, { cuotaId: otra, medio: "efectivo", claveIdempotencia: usada }),
    ).toMatchObject({ ok: false, error: { codigo: "clave-usada" } });
  });
});

describe("anular un pago", () => {
  it("pide motivo, deja la cuota sin pagar y no se anula dos veces", async () => {
    const { ctx, alumnoId, cuotaId } = await conCuota();
    const pago = await caja().cobrarCuota(ctx, {
      cuotaId,
      medio: "transferencia",
      claveIdempotencia: clave(),
    });
    if (!pago.ok) throw new Error(pago.error.mensaje);
    const id = pago.valor.id;

    expect(await caja().anular(ctx, { id, motivo: " " })).toMatchObject({
      ok: false,
      error: { codigo: "motivo-vacio" },
    });
    expect(await caja().anular(ctx, { id, motivo: "Se cobró a otro alumno" })).toEqual({
      ok: true,
      valor: null,
    });
    expect(await pagadaEn(ctx, alumnoId)).toBeNull();
    expect(await caja().anular(ctx, { id, motivo: "otra vez" })).toMatchObject({
      ok: false,
      error: { codigo: "pago-anulado" },
    });
  });
});

describe("el día de caja", () => {
  it("trae los pagos del día de la sede y lo cobrado sin los anulados", async () => {
    const { ctx, norte, alumno } = await conCuota();
    const cobrar = async (nombre: string) => {
      const cuotaId = await cuotaDe(ctx, norte, await alumno(nombre));
      const pago = await caja().cobrarCuota(ctx, {
        cuotaId,
        medio: "efectivo",
        claveIdempotencia: clave(),
      });
      if (!pago.ok) throw new Error(pago.error.mensaje);
      return pago.valor.id;
    };
    await cobrar("Caro");
    await caja().anular(ctx, { id: await cobrar("Dani"), motivo: "error" });

    const dia = await caja().delDia(ctx, {
      pagina: 1,
      porPagina: 50,
      sedeId: norte,
      dia: "2026-11-09",
    });
    expect(dia).toMatchObject({ ok: true, valor: { total: 2, cobrado: 30_000 } });
    const otroDia = await caja().delDia(ctx, {
      pagina: 1,
      porPagina: 50,
      sedeId: norte,
      dia: "2026-11-10",
    });
    expect(otroDia.ok && otroDia.valor.total).toBe(0);
    expect(
      await caja().delDia(ctx, { pagina: 1, porPagina: 50, sedeId: norte, dia: "9/11" }),
    ).toMatchObject({ ok: false, error: { codigo: "dia-invalido" } });
  });
});

describe("permisos", () => {
  it("cobrar pide caja.cobrar y anular, caja.anular, en la sede de la cuota", async () => {
    const { ctx, cuotaId, otra } = await conCuota();
    const soloVe = await otra({ norte: ["caja.ver"], sur: ["caja.cobrar"] });
    expect(
      await caja().cobrarCuota(soloVe, { cuotaId, medio: "efectivo", claveIdempotencia: clave() }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });

    const pago = await caja().cobrarCuota(ctx, {
      cuotaId,
      medio: "efectivo",
      claveIdempotencia: clave(),
    });
    if (!pago.ok) throw new Error(pago.error.mensaje);
    const cobra = await otra({ norte: ["caja.cobrar", "caja.ver"], sur: [] });
    expect(await caja().anular(cobra, { id: pago.valor.id, motivo: "error" })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
  });
});
