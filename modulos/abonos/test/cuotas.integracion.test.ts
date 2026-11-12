// Cuotas por ciclo de 4 semanas sobre Postgres real (0019): el precio de la sede, el monto
// congelado, ciclos que no se pisan, el día en la zona del centro, alumno de baja, anular y permisos.
import { fijarActivo } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const DOS = { nombre: "Dos por semana", clasesPorSemana: 2, precio: 30_000 };
/** 1 de diciembre a las 02:00 UTC: en Buenos Aires todavía es 30 de noviembre. */
const AHORA = new Date("2026-12-01T02:00:00Z");
const abonos = () => crearAbonos(base, { ahora: () => AHORA });

async function conPlan() {
  const centro = await centroConDosSedes(base);
  const alta = await abonos().crearPlan(centro.ctx, DOS);
  if (!alta.ok) throw new Error(alta.error.mensaje);
  await abonos().fijarPrecioDeSede(centro.ctx, {
    planId: alta.valor.id,
    sedeId: centro.norte,
    precio: 28_000,
  });
  return { ...centro, planId: alta.valor.id, ana: await centro.alumno() };
}

describe("generar la cuota", () => {
  it("dura 4 semanas desde hoy en el centro, con el precio de la sede", async () => {
    const { ctx, norte, planId, ana } = await conPlan();
    const cuota = await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: norte });
    expect(cuota).toMatchObject({
      ok: true,
      valor: { monto: 28_000, desde: "2026-11-30", hasta: "2026-12-28" },
    });
  });

  it("los ciclos de un alumno no se pisan, en ninguna sede; el siguiente empieza donde termina", async () => {
    const { ctx, norte, sur, planId, ana } = await conPlan();
    const pedido = { alumnoId: ana, planId, sedeId: norte };
    await abonos().generarCuota(ctx, pedido);
    const pisada = { ok: false, error: { codigo: "ya-tiene-cuota" } };
    expect(await abonos().generarCuota(ctx, { ...pedido, sedeId: sur })).toMatchObject(pisada);
    expect(await abonos().generarCuota(ctx, { ...pedido, desde: "2026-12-10" })).toMatchObject(
      pisada,
    );
    expect(await abonos().generarCuota(ctx, { ...pedido, desde: "2026-11-10" })).toMatchObject(
      pisada,
    );
    expect(
      await abonos().generarCuota(ctx, { ...pedido, sedeId: sur, desde: "2026-12-28" }),
    ).toMatchObject({
      ok: true,
      valor: { monto: 30_000, desde: "2026-12-28", hasta: "2027-01-25" },
    });
  });

  it("dos cuotas del mismo alumno a la vez: una sola queda", async () => {
    const { ctx, norte, planId, ana } = await conPlan();
    const pedido = { alumnoId: ana, planId, sedeId: norte };
    const resultados = await Promise.all([
      abonos().generarCuota(ctx, pedido),
      abonos().generarCuota(ctx, { ...pedido, desde: "2026-12-05" }),
    ]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
  });

  it("el monto queda congelado: cambiar el precio después no cambia la cuota", async () => {
    const { ctx, norte, planId, ana } = await conPlan();
    await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: norte });
    await abonos().fijarPrecioDeSede(ctx, { planId, sedeId: norte, precio: 40_000 });
    const lista = await abonos().cuotasDeAlumno(ctx, { ...PRIMERA, alumnoId: ana });
    expect(lista.ok && lista.valor.elementos.map((c) => c.monto)).toEqual([28_000]);
  });

  it("rechaza plan dado de baja, alumno de baja y día mal escrito", async () => {
    const { ctx, norte, planId, ana, alumno } = await conPlan();
    expect(
      await abonos().generarCuota(ctx, {
        alumnoId: ana,
        planId,
        sedeId: norte,
        desde: "30/11/2026",
      }),
    ).toMatchObject({ ok: false, error: { codigo: "dia-invalido" } });

    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: ana, activo: false }));
    expect(
      await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: norte }),
    ).toMatchObject({ ok: false, error: { codigo: "alumno-de-baja" } });

    await abonos().fijarActivo(ctx, { id: planId, activo: false });
    const bea = await alumno("Bea");
    expect(
      await abonos().generarCuota(ctx, { alumnoId: bea, planId, sedeId: norte }),
    ).toMatchObject({ ok: false, error: { codigo: "plan-inactivo" } });
  });
});

describe("anular y listar", () => {
  it("anular la cuota no la borra y permite generar otra en esas fechas", async () => {
    const { ctx, norte, planId, ana } = await conPlan();
    const cuota = await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: norte });
    if (!cuota.ok) throw new Error(cuota.error.mensaje);
    expect(await abonos().anularCuota(ctx, cuota.valor)).toEqual({ ok: true, valor: null });
    expect(await abonos().anularCuota(ctx, cuota.valor)).toMatchObject({
      ok: false,
      error: { codigo: "cuota-inexistente" },
    });
    expect((await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: norte })).ok).toBe(
      true,
    );
  });

  it("generar y anular piden abonos.asignar en la sede; la lista, abonos.ver", async () => {
    const { ctx, sur, planId, ana, otra } = await conPlan();
    await abonos().generarCuota(ctx, { alumnoId: ana, planId, sedeId: sur });
    const soloNorte = await otra({ norte: ["abonos.asignar", "abonos.ver"], sur: [] });
    expect(
      await abonos().generarCuota(soloNorte, {
        alumnoId: ana,
        planId,
        sedeId: sur,
        desde: "2027-01-25",
      }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
    const lista = await abonos().cuotasDeAlumno(soloNorte, { ...PRIMERA, alumnoId: ana });
    expect(lista.ok && lista.valor.total).toBe(0);
  });
});
