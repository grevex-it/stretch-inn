import { describe, expect, it } from "vitest";
import { multiplicar, pesos, restar, sumar } from "../src/index.ts";

describe("pesos", () => {
  it("acepta montos en pesos enteros, también negativos (saldos)", () => {
    expect(pesos(25000)).toBe(25000);
    expect(pesos(-1500)).toBe(-1500);
  });

  it("rechaza montos con decimales", () => {
    expect(() => pesos(10.5)).toThrow(/entero/);
  });

  it("rechaza montos fuera del rango seguro", () => {
    expect(() => pesos(Number.MAX_SAFE_INTEGER + 1)).toThrow(/entero/);
    expect(() => pesos(Number.NaN)).toThrow(/entero/);
  });
});

describe("sumar y restar", () => {
  it("operan en pesos enteros", () => {
    expect(sumar(pesos(25000), pesos(1500))).toBe(26500);
    expect(restar(pesos(1000), pesos(2500))).toBe(-1500);
  });

  it("rechazan un resultado fuera del rango seguro", () => {
    expect(() => sumar(pesos(Number.MAX_SAFE_INTEGER), pesos(1))).toThrow(/entero/);
  });
});

describe("multiplicar", () => {
  it("redondea al peso más cercano", () => {
    expect(multiplicar(pesos(25000), 0.15)).toBe(3750);
    expect(multiplicar(pesos(1000), 1 / 3)).toBe(333);
    expect(multiplicar(pesos(1000), 2 / 3)).toBe(667);
  });

  it("redondea ,5 lejos del cero, igual para negativos", () => {
    expect(multiplicar(pesos(1005), 0.5)).toBe(503);
    expect(multiplicar(pesos(-1005), 0.5)).toBe(-503);
  });

  it("rechaza factores que no son números finitos", () => {
    expect(() => multiplicar(pesos(1000), Number.POSITIVE_INFINITY)).toThrow(/factor/);
  });
});
