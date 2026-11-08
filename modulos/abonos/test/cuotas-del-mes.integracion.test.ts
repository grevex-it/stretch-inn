// Generar las cuotas del mes de una sede sobre Postgres real. [SUPUESTO] Se renuevan las cuotas
// vigentes del mes anterior: mismo alumno y plan, con el precio de hoy. Repetirlo no duplica.
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
/** 1 de diciembre a las 02:00 UTC: en Buenos Aires todavía es noviembre. */
const abonos = () => crearAbonos(base, { ahora: () => new Date("2026-12-01T02:00:00Z") });

async function conNoviembre() {
  const centro = await centroConDosSedes(base);
  const { ctx, norte, sur, alumno } = centro;
  const plan = async (nombre: string) => {
    const alta = await abonos().crearPlan(ctx, { nombre, clasesPorSemana: 2, precio: 30_000 });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    return alta.valor.id;
  };
  const [dos, viejo] = [await plan("Dos"), await plan("Viejo")];
  const cuota = async (alumnoId: string, planId: string, sedeId: string, periodo = "2026-11") => {
    const hecha = await abonos().generarCuota(ctx, { alumnoId, planId, sedeId, periodo });
    if (!hecha.ok) throw new Error(hecha.error.mensaje);
    return hecha.valor.id;
  };
  const [ana, bea, cami, dani, eva] = [
    await alumno("Ana"),
    await alumno("Bea"),
    await alumno("Cami"),
    await alumno("Dani"),
    await alumno("Eva"),
  ];
  await cuota(ana, dos, norte);
  await cuota(bea, dos, norte);
  await cuota(cami, viejo, norte);
  await abonos().anularCuota(ctx, { id: await cuota(dani, dos, norte) });
  await cuota(eva, dos, sur);
  await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: bea, activo: false }));
  await abonos().fijarActivo(ctx, { id: viejo, activo: false });
  await abonos().fijarPrecioDeSede(ctx, { planId: dos, sedeId: norte, precio: 32_000 });
  return { ...centro, dos, ana, dani, eva, cuota };
}

const periodos = async (ctx: ContextoCentro, id: string) => {
  const lista = await abonos().cuotasDeAlumno(ctx, { ...PRIMERA, alumnoId: id });
  return lista.ok ? lista.valor.elementos.map((c) => [c.periodo, c.monto, c.sedeId]) : [];
};

describe("generar las cuotas del mes de una sede", () => {
  it("renueva las del mes anterior con el precio de hoy, salvo alumnos y planes de baja", async () => {
    const { ctx, norte, ana, dani, eva } = await conNoviembre();
    const hecho = await abonos().generarCuotasDelMes(ctx, { sedeId: norte, periodo: "2026-12" });
    expect(hecho).toEqual({
      ok: true,
      valor: { periodo: "2026-12", generadas: 1, yaTenian: 0, alumnosDeBaja: 1, planesDeBaja: 1 },
    });
    expect(await periodos(ctx, ana)).toEqual([
      ["2026-12", 32_000, norte],
      ["2026-11", 30_000, norte],
    ]);
    expect(await periodos(ctx, dani)).toEqual([]);
    expect((await periodos(ctx, eva)).map(([periodo]) => periodo)).toEqual(["2026-11"]);
  });

  it("repetirlo no duplica: cuenta las que ya estaban", async () => {
    const { ctx, norte } = await conNoviembre();
    await abonos().generarCuotasDelMes(ctx, { sedeId: norte, periodo: "2026-12" });
    expect(
      await abonos().generarCuotasDelMes(ctx, { sedeId: norte, periodo: "2026-12" }),
    ).toMatchObject({ ok: true, valor: { generadas: 0, yaTenian: 1 } });
  });

  it("sin período, el mes actual del centro, a partir del anterior", async () => {
    const { ctx, norte, dos, ana, cuota } = await conNoviembre();
    await cuota(ana, dos, norte, "2026-10");
    expect(await abonos().generarCuotasDelMes(ctx, { sedeId: norte })).toMatchObject({
      ok: true,
      valor: { periodo: "2026-11", generadas: 0, yaTenian: 1 },
    });
  });

  it("renueva de a tandas: más de cien alumnos en una sede", async () => {
    const { ctx, sur, dos, alumno, cuota } = await conNoviembre();
    for (let i = 0; i < 101; i++) await cuota(await alumno(`Alumno ${i}`), dos, sur);
    expect(
      await abonos().generarCuotasDelMes(ctx, { sedeId: sur, periodo: "2026-12" }),
    ).toMatchObject({ ok: true, valor: { generadas: 102, yaTenian: 0 } });
  });

  it("pide abonos.asignar en la sede y un período bien escrito", async () => {
    const { ctx, norte, otra } = await conNoviembre();
    const soloSur = await otra({ norte: ["abonos.ver"], sur: ["abonos.asignar"] });
    expect(await abonos().generarCuotasDelMes(soloSur, { sedeId: norte })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    expect(
      await abonos().generarCuotasDelMes(ctx, { sedeId: norte, periodo: "12/26" }),
    ).toMatchObject({ ok: false, error: { codigo: "periodo-invalido" } });
  });
});
