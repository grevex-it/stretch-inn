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
  it("multiplica por una fracción de enteros y redondea al peso más cercano", () => {
    expect(multiplicar(pesos(25000), 15, 100)).toBe(3750);
    expect(multiplicar(pesos(1000), 1, 3)).toBe(333);
    expect(multiplicar(pesos(1000), 2, 3)).toBe(667);
    expect(multiplicar(pesos(1000), 3)).toBe(3000);
  });

  it("redondea ,5 lejos del cero, igual para negativos", () => {
    expect(multiplicar(pesos(1005), 1, 2)).toBe(503);
    expect(multiplicar(pesos(-1005), 1, 2)).toBe(-503);
  });

  it("es exacto en los empates que el punto flotante corre (R1)", () => {
    expect(multiplicar(pesos(50), 29, 100)).toBe(15);
    expect(multiplicar(pesos(-50), 29, 100)).toBe(-15);
  });

  it("es exacto aunque el producto intermedio supere el rango seguro", () => {
    expect(multiplicar(pesos(Number.MAX_SAFE_INTEGER), 1, 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(multiplicar(pesos(9_000_000_000_000_000), 999, 1000)).toBe(8_991_000_000_000_000);
  });

  it("rechaza numeradores y denominadores que no son enteros, y denominadores no positivos", () => {
    expect(() => multiplicar(pesos(1000), 0.29)).toThrow(/factor/);
    expect(() => multiplicar(pesos(1000), 1, 0)).toThrow(/factor/);
    expect(() => multiplicar(pesos(1000), 1, -3)).toThrow(/factor/);
    expect(() => multiplicar(pesos(1000), Number.POSITIVE_INFINITY)).toThrow(/factor/);
  });

  it("rechaza un resultado fuera del rango seguro", () => {
    expect(() => multiplicar(pesos(Number.MAX_SAFE_INTEGER), 2)).toThrow(/entero/);
  });
});
