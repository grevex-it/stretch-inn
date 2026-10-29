import { describe, expect, it } from "vitest";
import { puedeVerSede, type ContextoCentro } from "../src/index.ts";

const base = { centroId: "centro-1", usuarioId: "usuario-1" };

describe("puedeVerSede", () => {
  it("con alcance de centro ve cualquier sede", () => {
    const ctx: ContextoCentro = { ...base, alcance: { tipo: "centro" } };
    expect(puedeVerSede(ctx, "sede-norte")).toBe(true);
  });

  it("con alcance de sedes solo ve las suyas", () => {
    const ctx: ContextoCentro = { ...base, alcance: { tipo: "sedes", sedeIds: ["sede-norte"] } };
    expect(puedeVerSede(ctx, "sede-norte")).toBe(true);
    expect(puedeVerSede(ctx, "sede-sur")).toBe(false);
  });

  it("sin sedes asignadas no ve ninguna", () => {
    const ctx: ContextoCentro = { ...base, alcance: { tipo: "sedes", sedeIds: [] } };
    expect(puedeVerSede(ctx, "sede-norte")).toBe(false);
  });
});
