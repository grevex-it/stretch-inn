// Renovar los ciclos de una sede sobre Postgres real (0019): el ciclo que terminó se renueva desde
// el día en que terminó, con el mismo plan y el precio de hoy; quien quedó atrás se pone al día, y
// repetirlo no duplica. Sin alumnos ni planes de baja.
import type { ContextoCentro } from "@app/nucleo";
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
/** 1 de diciembre a las 02:00 UTC: en Buenos Aires todavía es 30 de noviembre. */
const abonos = () => crearAbonos(base, { ahora: () => new Date("2026-12-01T02:00:00Z") });

async function conCiclos() {
  const centro = await centroConDosSedes(base);
  const { ctx, norte, sur, alumno } = centro;
  const plan = async (nombre: string) => {
    const alta = await abonos().crearPlan(ctx, { nombre, clasesPorSemana: 1, precio: 30_000 });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    return alta.valor.id;
  };
  const [uno, viejo] = [await plan("Una por semana"), await plan("Viejo")];
  const cuota = async (alumnoId: string, planId: string, sedeId: string, desde = "2026-11-02") => {
    const hecha = await abonos().generarCuota(ctx, { alumnoId, planId, sedeId, desde });
    if (!hecha.ok) throw new Error(hecha.error.mensaje);
    return hecha.valor.id;
  };
  const [ana, bea, cami, dani, eva, fede] = [
    await alumno("Ana"),
    await alumno("Bea"),
    await alumno("Cami"),
    await alumno("Dani"),
    await alumno("Eva"),
    await alumno("Fede"),
  ];
  await cuota(ana, uno, norte);
  await cuota(bea, uno, norte);
  await cuota(cami, viejo, norte);
  await abonos().anularCuota(ctx, { id: await cuota(dani, uno, norte) });
  await cuota(eva, uno, sur);
  await cuota(fede, uno, norte, "2026-11-10");
  await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: bea, activo: false }));
  await abonos().fijarActivo(ctx, { id: viejo, activo: false });
  await abonos().fijarPrecioDeSede(ctx, { planId: uno, sedeId: norte, precio: 32_000 });
  return { ...centro, uno, ana, dani, eva, fede, cuota };
}

const ciclos = async (ctx: ContextoCentro, id: string) => {
  const lista = await abonos().cuotasDeAlumno(ctx, { ...PRIMERA, alumnoId: id });
  return lista.ok ? lista.valor.elementos.map((c) => [c.desde, c.hasta, c.monto]) : [];
};

describe("renovar los ciclos de una sede", () => {
  it("renueva los que terminaron hasta hoy, desde el día en que terminaron y al precio de hoy", async () => {
    const { ctx, norte, ana, dani, eva, fede } = await conCiclos();
    expect(await abonos().renovarCuotas(ctx, { sedeId: norte })).toEqual({
      ok: true,
      valor: { dia: "2026-11-30", generadas: 1, alumnosDeBaja: 1, planesDeBaja: 1 },
    });
    expect(await ciclos(ctx, ana)).toEqual([
      ["2026-11-30", "2026-12-28", 32_000],
      ["2026-11-02", "2026-11-30", 30_000],
    ]);
    expect(await ciclos(ctx, dani)).toEqual([]);
    expect(await ciclos(ctx, eva)).toHaveLength(1);
    expect(await ciclos(ctx, fede)).toHaveLength(1);
  });

  it("repetirlo no duplica", async () => {
    const { ctx, norte } = await conCiclos();
    await abonos().renovarCuotas(ctx, { sedeId: norte });
    expect(await abonos().renovarCuotas(ctx, { sedeId: norte })).toMatchObject({
      ok: true,
      valor: { generadas: 0 },
    });
  });

  it("quien quedó atrás se pone al día, ciclo por ciclo", async () => {
    const { ctx, sur, uno, alumno, cuota } = await conCiclos();
    const gabi = await alumno("Gabi");
    await cuota(gabi, uno, sur, "2026-10-05");
    // Gabi recibe los dos ciclos que le faltan; Eva, el suyo.
    expect(await abonos().renovarCuotas(ctx, { sedeId: sur })).toMatchObject({
      ok: true,
      valor: { generadas: 3 },
    });
    expect((await ciclos(ctx, gabi)).map(([desde]) => desde)).toEqual([
      "2026-11-30",
      "2026-11-02",
      "2026-10-05",
    ]);
  });

  it("renueva de a tandas: más de cien alumnos en una sede", async () => {
    const { ctx, sur, uno, alumno, cuota } = await conCiclos();
    for (let i = 0; i < 101; i++) await cuota(await alumno(`Alumno ${i}`), uno, sur);
    expect(await abonos().renovarCuotas(ctx, { sedeId: sur })).toMatchObject({
      ok: true,
      valor: { generadas: 102 },
    });
  });

  it("pide abonos.asignar en la sede y un día bien escrito", async () => {
    const { ctx, norte, otra } = await conCiclos();
    const soloSur = await otra({ norte: ["abonos.ver"], sur: ["abonos.asignar"] });
    expect(await abonos().renovarCuotas(soloSur, { sedeId: norte })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    expect(await abonos().renovarCuotas(ctx, { sedeId: norte, dia: "30/11/2026" })).toMatchObject({
      ok: false,
      error: { codigo: "dia-invalido" },
    });
  });
});
