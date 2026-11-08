// Cuotas impagas de una sede sobre Postgres real: sin pagadas ni anuladas, la más vieja primero,
// con el nombre del alumno y el total adeudado, y el permiso en la sede.
import { enContexto, crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos, registrarPago } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const abonos = () => crearAbonos(base, { ahora: () => new Date("2026-11-15T12:00:00Z") });

async function conDeudas() {
  const centro = await centroConDosSedes(base);
  const { ctx, norte, sur, alumno } = centro;
  const alta = await abonos().crearPlan(ctx, { nombre: "Dos", clasesPorSemana: 2, precio: 30_000 });
  if (!alta.ok) throw new Error(alta.error.mensaje);
  const planId = alta.valor.id;
  await abonos().fijarPrecioDeSede(ctx, { planId, sedeId: norte, precio: 28_000 });
  const cuota = async (alumnoId: string, sedeId: string, periodo: string) => {
    const hecha = await abonos().generarCuota(ctx, { alumnoId, planId, sedeId, periodo });
    if (!hecha.ok) throw new Error(hecha.error.mensaje);
    return hecha.valor.id;
  };
  const [ana, bea, cami, dani] = [
    await alumno("Ana"),
    await alumno("Bea"),
    await alumno("Cami"),
    await alumno("Dani"),
  ];
  const octubre = await cuota(ana, norte, "2026-10");
  const noviembre = await cuota(ana, norte, "2026-11");
  const pagada = await cuota(bea, norte, "2026-11");
  await enContexto(base, ctx, (tx) =>
    registrarPago(tx, { cuotaId: pagada, pagoId: randomUUID(), en: new Date() }),
  );
  await cuota(cami, sur, "2026-11");
  await abonos().anularCuota(ctx, { id: await cuota(dani, norte, "2026-11") });
  return { ...centro, planId, ana, octubre, noviembre };
}

describe("cuotas impagas de una sede", () => {
  it("sin pagadas, anuladas ni de otra sede; la más vieja primero, con el alumno y el total", async () => {
    const { ctx, norte, planId, ana, octubre, noviembre } = await conDeudas();
    const lista = await abonos().cuotasImpagas(ctx, { ...PRIMERA, sedeId: norte });
    expect(lista).toMatchObject({
      ok: true,
      valor: { total: 2, adeudado: 56_000, pagina: 1, porPagina: 50 },
    });
    const elementos = lista.ok ? lista.valor.elementos : [];
    expect(elementos[0]).toEqual({
      id: octubre,
      alumnoId: ana,
      planId,
      sedeId: norte,
      periodo: "2026-10",
      monto: 28_000,
      alumno: { nombre: "Ana", apellido: "Prueba", activo: true },
    });
    expect(elementos.map((c) => [c.id, c.periodo])).toEqual([
      [octubre, "2026-10"],
      [noviembre, "2026-11"],
    ]);
  });

  it("con período, solo las de ese mes", async () => {
    const { ctx, norte, noviembre } = await conDeudas();
    const lista = await abonos().cuotasImpagas(ctx, {
      ...PRIMERA,
      sedeId: norte,
      periodo: "2026-11",
    });
    expect(lista.ok && lista.valor.elementos.map((c) => c.id)).toEqual([noviembre]);
    expect(lista.ok && lista.valor.adeudado).toBe(28_000);
  });

  it("pide abonos.ver en esa sede", async () => {
    const { norte, otra } = await conDeudas();
    const soloSur = await otra({ norte: [], sur: ["abonos.ver"] });
    expect(await abonos().cuotasImpagas(soloSur, { ...PRIMERA, sedeId: norte })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
  });
});
