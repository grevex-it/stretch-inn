// Hasta cuándo vale el crédito de un aviso, sin base (0019).
import { describe, expect, it } from "vitest";
import { venceEl } from "../../src/dominio/credito.ts";

const EMPIEZA = new Date("2026-11-09T21:30:00Z");

describe("venceEl", () => {
  it("vence cuando termina el abono del alumno", () => {
    const fin = new Date("2026-11-30T03:00:00Z");
    expect(venceEl(EMPIEZA, fin)).toEqual(fin);
  });

  it("[SUPUESTO] sin abono vigente, vence a las 4 semanas de la fecha a la que se faltó", () => {
    expect(venceEl(EMPIEZA, undefined)).toEqual(new Date("2026-12-07T21:30:00Z"));
  });

  it("un fin de abono que no es posterior a la fecha no se usa", () => {
    expect(venceEl(EMPIEZA, EMPIEZA)).toEqual(new Date("2026-12-07T21:30:00Z"));
  });
});
