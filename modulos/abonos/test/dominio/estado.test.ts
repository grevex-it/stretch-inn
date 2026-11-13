// Cuántas clases del abono se usaron y cuántas quedan: cada fecha que ya terminó gasta una (0020).
import { describe, expect, it } from "vitest";
import { estadoDelAbono } from "../../src/dominio/estado.ts";

const clase = (instante: string) => ({ terminaEn: new Date(instante) });
const CUATRO = [
  clase("2026-11-16T22:30:00Z"),
  clase("2026-11-23T22:30:00Z"),
  clase("2026-11-30T22:30:00Z"),
  clase("2026-12-07T22:30:00Z"),
];

describe("estadoDelAbono", () => {
  it("cuenta como usada cada fecha que ya terminó, haya venido o no", () => {
    expect(estadoDelAbono(4, CUATRO, new Date("2026-11-15T12:00:00Z"))).toEqual({
      usadas: 0,
      restantes: 4,
      fin: new Date("2026-12-07T22:30:00Z"),
    });
    expect(estadoDelAbono(4, CUATRO, new Date("2026-11-23T22:30:00Z"))).toMatchObject({
      usadas: 2,
      restantes: 2,
    });
  });

  it("después de la última clase no quedan clases", () => {
    expect(estadoDelAbono(4, CUATRO, new Date("2026-12-20T12:00:00Z"))).toMatchObject({
      usadas: 4,
      restantes: 0,
    });
  });

  it("sin todas sus fechas (sin horario fijo), no sabe cuándo termina", () => {
    expect(estadoDelAbono(4, CUATRO.slice(0, 1), new Date("2026-11-20T12:00:00Z"))).toEqual({
      usadas: 1,
      restantes: 3,
      fin: null,
    });
  });
});
