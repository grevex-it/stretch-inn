// Los profes del centro con su tipo (empleado o socio) y las tarifas por clase en cuatro niveles,
// con vigencia (0024). Sobre Postgres real, con RLS.
import { crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearProfesores, type Profesores } from "../src/index.ts";
import { centroConDosSedes, profe } from "./ayudas.ts";

let base: Base;
let profesores: Profesores;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  profesores = crearProfesores(base, { ahora: () => new Date("2026-11-20T15:00:00Z") });
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };

describe("profes y su tipo", () => {
  it("el equipo activo con su tipo: empleado si no se fijó otro", async () => {
    const { ctx } = await centroConDosSedes(base);
    const [lore, ana] = [await profe(ctx.centroId, "Lore"), await profe(ctx.centroId, "Ana")];
    await profe(ctx.centroId, "Inactiva", false);

    expect((await profesores.fijarTipo(ctx, { profeId: ana, tipo: "socio" })).ok).toBe(true);
    const lista = await profesores.profes(ctx, PRIMERA);

    if (!lista.ok) throw new Error(lista.error.mensaje);
    const tipos = new Map(lista.valor.elementos.map((p) => [p.id, p.tipo]));
    expect(tipos.get(lore)).toBe("empleado");
    expect(tipos.get(ana)).toBe("socio");
    expect(lista.valor.elementos.some((p) => p.nombre === "Inactiva")).toBe(false);
  });

  it("solo un usuario activo del centro, y pide configurar", async () => {
    const { ctx, otra } = await centroConDosSedes(base);
    const soloVe = await otra({ norte: ["profesores.ver"], sur: [] });

    const ajeno = await profesores.fijarTipo(ctx, { profeId: randomUUID(), tipo: "socio" });
    expect(!ajeno.ok && ajeno.error.codigo).toBe("profe-invalido");
    const sinPermiso = await profesores.fijarTipo(soloVe, {
      profeId: await profe(ctx.centroId, "Lore"),
      tipo: "socio",
    });
    expect(!sinPermiso.ok && sinPermiso.error.codigo).toBe("sin-permiso");
  });
});

describe("tarifas", () => {
  it("se cargan en los cuatro niveles y una nueva cierra la anterior del mismo alcance", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const lore = await profe(ctx.centroId, "Lore");
    const fijar = (
      cambio: Partial<{ sedeId: string | null; profeId: string | null }>,
      monto: number,
      desde = "2026-11-20",
    ) => profesores.fijarTarifa(ctx, { sedeId: null, profeId: null, monto, desde, ...cambio });

    expect((await fijar({}, 10_000)).ok).toBe(true);
    expect((await fijar({ profeId: lore }, 14_000)).ok).toBe(true);
    expect((await fijar({ sedeId: norte }, 12_000)).ok).toBe(true);
    expect((await fijar({ sedeId: norte, profeId: lore }, 15_000)).ok).toBe(true);
    expect((await fijar({}, 11_000, "2026-12-01")).ok).toBe(true);

    const delCentro = await profesores.tarifas(ctx, { ...PRIMERA, sedeId: null });
    if (!delCentro.ok) throw new Error(delCentro.error.mensaje);
    expect(
      delCentro.valor.elementos.map(({ profeId, monto, desde, hasta }) => ({
        profeId,
        monto,
        desde,
        hasta,
      })),
    ).toEqual([
      { profeId: null, monto: 11_000, desde: "2026-12-01", hasta: null },
      { profeId: lore, monto: 14_000, desde: "2026-11-20", hasta: null },
      { profeId: null, monto: 10_000, desde: "2026-11-20", hasta: "2026-11-30" },
    ]);
    const deNorte = await profesores.tarifas(ctx, { ...PRIMERA, sedeId: norte });
    expect(deNorte.ok && deNorte.valor.total).toBe(2);
  });

  it("valida el monto, el día y el profe, y pide configurar en la sede", async () => {
    const { ctx, norte, otra } = await centroConDosSedes(base);
    const pedido = { sedeId: norte, profeId: null, monto: 10_000, desde: "2026-11-20" };

    const atras = await profesores.fijarTarifa(ctx, { ...pedido, desde: "2026-11-19" });
    expect(!atras.ok && atras.error.codigo).toBe("desde-pasado");
    const centavos = await profesores.fijarTarifa(ctx, { ...pedido, monto: 1.5 });
    expect(!centavos.ok && centavos.error.codigo).toBe("monto-invalido");
    const ajeno = await profesores.fijarTarifa(ctx, { ...pedido, profeId: randomUUID() });
    expect(!ajeno.ok && ajeno.error.codigo).toBe("profe-invalido");
    const deSur = await otra({ norte: [], sur: ["profesores.configurar"] });
    const enNorte = await profesores.fijarTarifa(deSur, pedido);
    expect(!enNorte.ok && enNorte.error.codigo).toBe("sin-permiso");
  });
});
