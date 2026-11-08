// Cuándo se avisa una ausencia, sin base.
import { describe, expect, it } from "vitest";
import { puedeAvisar } from "../../src/dominio/aviso.ts";

const EMPIEZA = new Date("2026-11-09T21:30:00Z");

describe("puedeAvisar", () => {
  it("se avisa hasta el inicio de la clase, no después", () => {
    const fecha = { cancelada: false, empiezaEn: EMPIEZA };
    expect(puedeAvisar(fecha, new Date(EMPIEZA.getTime() - 1)).ok).toBe(true);
    expect(puedeAvisar(fecha, EMPIEZA)).toEqual({
      ok: false,
      error: {
        codigo: "clase-empezada",
        mensaje: "La clase ya empezó: la ausencia se avisa antes.",
      },
    });
  });

  it("en una fecha cancelada no hay nada que avisar", () => {
    expect(
      puedeAvisar({ cancelada: true, empiezaEn: EMPIEZA }, new Date(EMPIEZA.getTime() - 60_000)),
    ).toMatchObject({ ok: false, error: { codigo: "fecha-cancelada" } });
  });
});
