// Planes y precios por sede sobre Postgres real: alta, edición con versión, baja, precio propio
// de una sede, aislamiento por centro y permisos.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos, type Abonos } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
let abonos: Abonos;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  abonos = crearAbonos(base);
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const DOS = { nombre: "Dos por semana", clasesPorSemana: 2, precio: 30_000 };

describe("planes", () => {
  it("crea, edita con la versión y lista con los precios propios de cada sede", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const alta = await abonos.crearPlan(ctx, DOS);
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const id = alta.valor.id;

    expect(await abonos.editarPlan(ctx, { ...DOS, id, version: 1, precio: 32_000 })).toEqual({
      ok: true,
      valor: { version: 2 },
    });
    expect(await abonos.editarPlan(ctx, { ...DOS, id, version: 1 })).toMatchObject({
      ok: false,
      error: { codigo: "cambio-concurrente" },
    });
    await abonos.fijarPrecioDeSede(ctx, { planId: id, sedeId: norte, precio: 28_000 });

    expect(await abonos.planes(ctx, PRIMERA)).toEqual({
      ok: true,
      valor: {
        ...PRIMERA,
        total: 1,
        elementos: [
          {
            id,
            nombre: "Dos por semana",
            clasesPorSemana: 2,
            precio: 32_000,
            activo: true,
            version: 2,
            preciosDeSede: [{ sedeId: norte, precio: 28_000 }],
          },
        ],
      },
    });
  });

  it("valida el plan; con precio null la sede vuelve al general; la baja no borra", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    expect(await abonos.crearPlan(ctx, { ...DOS, precio: 10.5 })).toMatchObject({
      ok: false,
      error: { codigo: "precio-invalido" },
    });
    const alta = await abonos.crearPlan(ctx, DOS);
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const planId = alta.valor.id;
    await abonos.fijarPrecioDeSede(ctx, { planId, sedeId: norte, precio: 28_000 });
    await abonos.fijarPrecioDeSede(ctx, { planId, sedeId: norte, precio: null });
    await abonos.fijarActivo(ctx, { id: planId, activo: false });

    const lista = await abonos.planes(ctx, PRIMERA);
    expect(lista.ok && lista.valor.elementos[0]).toMatchObject({
      activo: false,
      preciosDeSede: [],
    });
  });

  it("los planes de otro centro no se ven; sin abonos.gestionar no se crean ni se editan", async () => {
    const { ctx } = await centroConDosSedes(base);
    const alta = await abonos.crearPlan(ctx, DOS);
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const otroCentro = await centroConDosSedes(base);
    const lista = await abonos.planes(otroCentro.ctx, PRIMERA);
    expect(lista.ok && lista.valor.total).toBe(0);
    expect(
      await abonos.editarPlan(otroCentro.ctx, { ...DOS, id: alta.valor.id, version: 1 }),
    ).toMatchObject({ ok: false, error: { codigo: "plan-inexistente" } });

    const { otra } = await centroConDosSedes(base);
    const soloVe = await otra({ norte: ["abonos.ver"], sur: [] });
    expect(await abonos.crearPlan(soloVe, DOS)).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
  });

  it("el precio de una sede pide abonos.gestionar en esa sede", async () => {
    const { ctx, sur, otra } = await centroConDosSedes(base);
    const alta = await abonos.crearPlan(ctx, DOS);
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const soloNorte = await otra({ norte: ["abonos.gestionar"], sur: ["abonos.ver"] });
    expect(
      await abonos.fijarPrecioDeSede(soloNorte, {
        planId: alta.valor.id,
        sedeId: sur,
        precio: 1_000,
      }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});
