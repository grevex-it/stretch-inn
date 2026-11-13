// Gastos sobre Postgres real (0022): cargar uno sin cargarlo dos veces (regla 7), anularlo con
// motivo y los de un período de una sede con su total. Cada permiso, en la sede del gasto.
import { crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearGastos, type Gastos } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
let gastos: Gastos;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  gastos = crearGastos(base, { ahora: () => new Date("2026-11-13T15:00:00Z") });
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const gasto = (sedeId: string, cambios: Record<string, unknown> = {}) => ({
  sedeId,
  fecha: "2026-11-10",
  monto: 45_000,
  categoria: "servicios",
  medio: "transferencia",
  descripcion: "Luz de octubre",
  claveIdempotencia: randomUUID(),
  ...cambios,
});

describe("cargar", () => {
  it("carga el gasto; el mismo pedido repetido no carga otro", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const pedido = gasto(norte);

    const primero = await gastos.cargar(ctx, pedido);
    const repetido = await gastos.cargar(ctx, pedido);

    expect(primero.ok && primero.valor.repetido).toBe(false);
    expect(repetido.ok && repetido.valor).toEqual({
      id: primero.ok && primero.valor.id,
      repetido: true,
    });
    const lista = await gastos.delPeriodo(ctx, {
      ...PRIMERA,
      sedeId: norte,
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });
    expect(lista.ok && lista.valor.total).toBe(1);
  });

  it("la misma clave en otro gasto no se reutiliza", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const clave = randomUUID();
    await gastos.cargar(ctx, gasto(norte, { claveIdempotencia: clave }));

    const otro = await gastos.cargar(ctx, gasto(norte, { claveIdempotencia: clave, monto: 1 }));

    expect(!otro.ok && otro.error.codigo).toBe("clave-usada");
  });

  it("hace falta cargar gastos en esa sede", async () => {
    const { norte, otra } = await centroConDosSedes(base);
    const encargado = await otra({ norte: ["gastos.ver"], sur: ["gastos.cargar"] });

    const cargado = await gastos.cargar(encargado, gasto(norte));

    expect(!cargado.ok && cargado.error.codigo).toBe("sin-permiso");
  });
});

describe("delPeriodo y anular", () => {
  it("lista los del período, el más nuevo primero, y suma sin los anulados", async () => {
    const { ctx, norte, sur } = await centroConDosSedes(base);
    const viejo = await gastos.cargar(ctx, gasto(norte, { fecha: "2026-10-31", monto: 1_000 }));
    const luz = await gastos.cargar(ctx, gasto(norte, { fecha: "2026-11-02", monto: 10_000 }));
    const gas = await gastos.cargar(ctx, gasto(norte, { fecha: "2026-11-05", monto: 5_000 }));
    await gastos.cargar(ctx, gasto(sur, { fecha: "2026-11-05", monto: 7_000 }));
    if (!viejo.ok || !luz.ok || !gas.ok) throw new Error("No se cargaron los gastos.");

    const anulado = await gastos.anular(ctx, { id: gas.valor.id, motivo: "Se cargó dos veces" });
    expect(anulado.ok).toBe(true);
    const lista = await gastos.delPeriodo(ctx, {
      ...PRIMERA,
      sedeId: norte,
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });

    if (!lista.ok) throw new Error(lista.error.mensaje);
    expect(lista.valor.elementos.map((g) => g.id)).toEqual([gas.valor.id, luz.valor.id]);
    expect(lista.valor.gastado).toBe(10_000);
    expect(lista.valor.elementos[0]?.motivoAnulacion).toBe("Se cargó dos veces");
  });

  it("anular pide motivo, no anula dos veces y pide el permiso en la sede", async () => {
    const { ctx, norte, otra } = await centroConDosSedes(base);
    const cargado = await gastos.cargar(ctx, gasto(norte));
    if (!cargado.ok) throw new Error(cargado.error.mensaje);
    const id = cargado.valor.id;

    const sinMotivo = await gastos.anular(ctx, { id, motivo: "  " });
    expect(!sinMotivo.ok && sinMotivo.error.codigo).toBe("motivo-vacio");
    const sinPermiso = await gastos.anular(await otra({ norte: ["gastos.ver"], sur: [] }), {
      id,
      motivo: "No va",
    });
    expect(!sinPermiso.ok && sinPermiso.error.codigo).toBe("sin-permiso");
    await gastos.anular(ctx, { id, motivo: "No va" });
    const otraVez = await gastos.anular(ctx, { id, motivo: "No va" });
    expect(!otraVez.ok && otraVez.error.codigo).toBe("gasto-anulado");
    const inexistente = await gastos.anular(ctx, { id: randomUUID(), motivo: "No va" });
    expect(!inexistente.ok && inexistente.error.codigo).toBe("gasto-inexistente");
  });

  it("ver pide el permiso en la sede; el período va de un día a otro", async () => {
    const { ctx, norte, otra } = await centroConDosSedes(base);
    const ajena = await otra({ norte: [], sur: ["gastos.ver"] });
    const filtro = { ...PRIMERA, sedeId: norte, desde: "2026-11-01", hasta: "2026-11-30" };

    const sinPermiso = await gastos.delPeriodo(ajena, filtro);
    expect(!sinPermiso.ok && sinPermiso.error.codigo).toBe("sin-permiso");
    const alReves = await gastos.delPeriodo(ctx, { ...filtro, desde: "2026-12-01" });
    expect(!alReves.ok && alReves.error.codigo).toBe("periodo-invalido");
  });
});
