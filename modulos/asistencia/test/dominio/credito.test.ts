// Cuándo un aviso da crédito para recuperar y hasta cuándo vale, sin base.
import { describe, expect, it } from "vitest";
import { daCredito, venceEl } from "../../src/dominio/credito.ts";

const EMPIEZA = new Date("2026-11-09T21:30:00Z");
const HORA = 60 * 60_000;

describe("daCredito", () => {
  it("[SUPUESTO] el aviso con 2 horas o más de anticipación da crédito; más tarde, no", () => {
    expect(daCredito(EMPIEZA, new Date(EMPIEZA.getTime() - 2 * HORA))).toBe(true);
    expect(daCredito(EMPIEZA, new Date(EMPIEZA.getTime() - 3 * 24 * HORA))).toBe(true);
    expect(daCredito(EMPIEZA, new Date(EMPIEZA.getTime() - 2 * HORA + 1))).toBe(false);
  });
});

describe("venceEl", () => {
  it("[SUPUESTO] el crédito vence a los 30 días de la fecha a la que se faltó", () => {
    expect(venceEl(EMPIEZA)).toEqual(new Date("2026-12-09T21:30:00Z"));
  });
});
