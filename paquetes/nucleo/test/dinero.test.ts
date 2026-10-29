import { describe, expect, it } from "vitest";
import { centavos, sumar } from "../src/index.ts";

describe("dinero", () => {
  it("guarda montos como centavos enteros", () => {
    expect(sumar(centavos(1050), centavos(250))).toBe(1300);
  });

  it("rechaza montos con decimales", () => {
    expect(() => centavos(10.5)).toThrow(/entero/);
  });

  it("rechaza montos fuera del rango seguro", () => {
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 1)).toThrow(/entero/);
  });
});
