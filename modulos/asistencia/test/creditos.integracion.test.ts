// Créditos de recuperación sobre Postgres real: el aviso a tiempo da crédito, el tardío no,
// anular el aviso anula el crédito, el vencimiento y las sedes donde se ven.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia } from "../src/index.ts";
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
const DIA = 24 * HORA;

const aLas = (empiezaEn: Date, corrimiento: number) =>
  crearAsistencia(base, { ahora: () => new Date(empiezaEn.getTime() + corrimiento) });

describe("créditos", () => {
  it("[SUPUESTO] el aviso con 2 horas o más da crédito, que vence a los 30 días de la fecha", async () => {
    const { ctx, ana, norte, fecha } = await claseConFecha(base);
    const antes = aLas(fecha.empiezaEn, -3 * HORA);

    expect(await antes.avisar(ctx, { fechaId: fecha.id, alumnoId: ana })).toMatchObject({
      ok: true,
      valor: { conCredito: true },
    });
    const lista = await antes.creditos(ctx, { ...PRIMERA, alumnoId: ana });
    if (!lista.ok) throw new Error(lista.error.mensaje);
    expect(lista.valor.total).toBe(1);
    expect(lista.valor.elementos[0]).toMatchObject({
      sedeId: norte,
      ocurrenciaId: fecha.id,
      venceEn: new Date(fecha.empiezaEn.getTime() + 30 * DIA),
    });
  });

  it("el aviso tardío no da crédito", async () => {
    const { ctx, bea, fecha } = await claseConFecha(base);
    const tarde = aLas(fecha.empiezaEn, -HORA);
    expect(await tarde.avisar(ctx, { fechaId: fecha.id, alumnoId: bea })).toMatchObject({
      ok: true,
      valor: { conCredito: false },
    });
    const lista = await tarde.creditos(ctx, { ...PRIMERA, alumnoId: bea });
    expect(lista.ok && lista.valor.total).toBe(0);
  });

  it("anular el aviso anula su crédito; un crédito vencido no figura", async () => {
    const { ctx, ana, bea, fecha } = await claseConFecha(base);
    const antes = aLas(fecha.empiezaEn, -3 * HORA);
    const aviso = await antes.avisar(ctx, { fechaId: fecha.id, alumnoId: ana });
    if (!aviso.ok) throw new Error(aviso.error.mensaje);
    await antes.anularAviso(ctx, aviso.valor);
    const deAna = await antes.creditos(ctx, { ...PRIMERA, alumnoId: ana });
    expect(deAna.ok && deAna.valor.total).toBe(0);

    await antes.avisar(ctx, { fechaId: fecha.id, alumnoId: bea });
    const vencido = aLas(fecha.empiezaEn, 31 * DIA);
    const deBea = await vencido.creditos(ctx, { ...PRIMERA, alumnoId: bea });
    expect(deBea.ok && deBea.valor.total).toBe(0);
  });

  it("los créditos se ven solo en las sedes donde se puede ver la asistencia", async () => {
    const { ctx, ana, fecha, otra } = await claseConFecha(base);
    await aLas(fecha.empiezaEn, -3 * HORA).avisar(ctx, { fechaId: fecha.id, alumnoId: ana });
    const sinVer = await otra(["asistencia.tomar"]);
    const lista = await aLas(fecha.empiezaEn, -3 * HORA).creditos(sinVer, {
      ...PRIMERA,
      alumnoId: ana,
    });
    expect(lista.ok && lista.valor.total).toBe(0);
  });
});
