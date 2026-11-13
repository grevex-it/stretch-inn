// El abono actual de un alumno en una sede, con las clases que le quedan (0020): para la ficha y
// para que el profe sepa cuántas le quedan. Sobre Postgres real, con RLS.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos } from "../src/index.ts";
import { centroConDosSedes, conHorario } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const abonosEl = (instante: string) => crearAbonos(base, { ahora: () => new Date(instante) });

/** Abono de 4 clases desde el 15/11, con clase los lunes: 16/11, 23/11, 30/11 y 7/12. */
async function conCuota() {
  const centro = await centroConDosSedes(base);
  const abonos = abonosEl("2026-11-15T12:00:00Z");
  const plan = await abonos.crearPlan(centro.ctx, {
    nombre: "Abono de 4 clases",
    clases: 4,
    precio: 35_000,
  });
  if (!plan.ok) throw new Error(plan.error.mensaje);
  const alumnoId = await centro.alumno();
  await conHorario(base, centro.ctx, { sedeId: centro.norte, alumnoId, dias: [1] });
  const cuota = await abonos.generarCuota(centro.ctx, {
    alumnoId,
    planId: plan.valor.id,
    sedeId: centro.norte,
  });
  if (!cuota.ok) throw new Error(cuota.error.mensaje);
  return { ...centro, alumnoId, cuotaId: cuota.valor.id };
}

describe("abonoDelAlumno", () => {
  it("trae el abono que empezó, con las clases usadas, las que quedan y cuándo termina", async () => {
    const { ctx, norte, alumnoId, cuotaId } = await conCuota();

    const abono = await abonosEl("2026-11-24T12:00:00Z").abonoDelAlumno(ctx, {
      alumnoId,
      sedeId: norte,
    });

    expect(abono).toEqual({
      ok: true,
      valor: {
        cuotaId,
        desde: "2026-11-15",
        clases: 4,
        usadas: 2,
        restantes: 2,
        fin: new Date("2026-12-07T22:30:00Z"),
        pagada: false,
      },
    });
  });

  it("terminado y sin abono nuevo, sigue mostrando el último con 0 clases", async () => {
    const { ctx, norte, alumnoId } = await conCuota();

    const abono = await abonosEl("2026-12-20T12:00:00Z").abonoDelAlumno(ctx, {
      alumnoId,
      sedeId: norte,
    });

    expect(abono.ok && abono.valor).toMatchObject({ usadas: 4, restantes: 0 });
  });

  it("sin abono en la sede, o antes de que empiece, no hay", async () => {
    const { ctx, norte, sur, alumnoId } = await conCuota();

    const enSur = await abonosEl("2026-11-24T12:00:00Z").abonoDelAlumno(ctx, {
      alumnoId,
      sedeId: sur,
    });
    const antes = await abonosEl("2026-11-14T12:00:00Z").abonoDelAlumno(ctx, {
      alumnoId,
      sedeId: norte,
    });

    expect(enSur).toEqual({ ok: true, valor: null });
    expect(antes).toEqual({ ok: true, valor: null });
  });

  it("hace falta ver los abonos en esa sede", async () => {
    const { norte, alumnoId, otra } = await conCuota();
    const sinPermiso = await otra({ norte: ["personas.ver"], sur: ["abonos.ver"] });

    const abono = await abonosEl("2026-11-24T12:00:00Z").abonoDelAlumno(sinPermiso, {
      alumnoId,
      sedeId: norte,
    });

    expect(abono.ok).toBe(false);
    expect(!abono.ok && abono.error.codigo).toBe("sin-permiso");
  });
});
