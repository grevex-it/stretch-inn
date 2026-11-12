// Créditos de recuperación sobre Postgres real: todo aviso antes del inicio da crédito, que vence
// con el abono (0019); anular el aviso anula el crédito, el vencimiento y las sedes donde se ven.
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

const aLas = (empiezaEn: Date, corrimiento: number, finDelAbono?: Date) =>
  crearAsistencia(base, {
    ahora: () => new Date(empiezaEn.getTime() + corrimiento),
    ...(finDelAbono && { finDelAbono: () => Promise.resolve(finDelAbono) }),
  });

describe("créditos", () => {
  it("el aviso da crédito, que vence cuando termina el abono del alumno", async () => {
    const { ctx, ana, norte, fecha } = await claseConFecha(base);
    const finDelAbono = new Date(fecha.empiezaEn.getTime() + 10 * DIA);
    const antes = aLas(fecha.empiezaEn, -3 * HORA, finDelAbono);

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
      venceEn: finDelAbono,
    });
  });

  it("el aviso un minuto antes del inicio también da crédito (sin anticipación mínima)", async () => {
    const { ctx, bea, fecha } = await claseConFecha(base);
    const justo = aLas(fecha.empiezaEn, -60_000);
    expect(await justo.avisar(ctx, { fechaId: fecha.id, alumnoId: bea })).toMatchObject({
      ok: true,
      valor: { conCredito: true },
    });
    const lista = await justo.creditos(ctx, { ...PRIMERA, alumnoId: bea });
    if (!lista.ok) throw new Error(lista.error.mensaje);
    expect(lista.valor.elementos[0]?.venceEn).toEqual(
      new Date(fecha.empiezaEn.getTime() + 28 * DIA),
    );
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
    const vencido = aLas(fecha.empiezaEn, 29 * DIA);
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
