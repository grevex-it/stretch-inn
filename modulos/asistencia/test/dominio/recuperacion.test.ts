// Cuándo se puede reservar una recuperación y cuántos lugares tiene una fecha, sin base.
import { describe, expect, it } from "vitest";
import { lugaresLibres, puedeRecuperar } from "../../src/dominio/recuperacion.ts";

const EMPIEZA = new Date("2026-11-09T21:30:00Z");
const ANTES = new Date(EMPIEZA.getTime() - 60_000);

describe("lugaresLibres", () => {
  it("cupo − inscriptos + avisos − recuperaciones, nunca negativo", () => {
    expect(lugaresLibres({ cupo: 12, inscriptos: 12, avisos: 2, recuperaciones: 1 })).toBe(1);
    expect(lugaresLibres({ cupo: 12, inscriptos: 8, avisos: 0, recuperaciones: 0 })).toBe(4);
    expect(lugaresLibres({ cupo: 12, inscriptos: 12, avisos: 0, recuperaciones: 1 })).toBe(0);
  });
});

describe("puedeRecuperar", () => {
  const fecha = { cancelada: false, empiezaEn: EMPIEZA };

  it("con lugar, antes del inicio y en una fecha no cancelada", () => {
    expect(puedeRecuperar(fecha, ANTES, 1)).toEqual({ ok: true, valor: null });
  });

  it("sin lugar, empezada o cancelada, no", () => {
    expect(puedeRecuperar(fecha, ANTES, 0)).toEqual({
      ok: false,
      error: { codigo: "sin-lugar", mensaje: "No quedan lugares para recuperar en esa fecha." },
    });
    expect(puedeRecuperar(fecha, EMPIEZA, 3)).toMatchObject({
      ok: false,
      error: { codigo: "clase-empezada" },
    });
    expect(puedeRecuperar({ ...fecha, cancelada: true }, ANTES, 3)).toMatchObject({
      ok: false,
      error: { codigo: "fecha-cancelada" },
    });
  });
});
