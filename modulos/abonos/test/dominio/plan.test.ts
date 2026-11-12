// Reglas de los planes y sus precios, sin base.
import { pesos } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import { limpiarPlan, precioEnSede } from "../../src/dominio/plan.ts";

const PLAN = { nombre: " Abono de 4 clases ", clases: 4, precio: 30_000 };

describe("limpiarPlan", () => {
  it("recorta el nombre y deja el precio en pesos enteros", () => {
    expect(limpiarPlan(PLAN)).toEqual({
      ok: true,
      valor: { nombre: "Abono de 4 clases", clases: 4, precio: pesos(30_000) },
    });
  });

  it("rechaza nombre vacío, clases fuera de 1 a 100 y precios no enteros, negativos o enormes", () => {
    const codigo = (datos: typeof PLAN) => {
      const resultado = limpiarPlan(datos);
      return resultado.ok ? "ok" : resultado.error.codigo;
    };
    expect(codigo({ ...PLAN, nombre: "  " })).toBe("nombre-vacio");
    expect(codigo({ ...PLAN, clases: 0 })).toBe("clases-invalidas");
    expect(codigo({ ...PLAN, clases: 101 })).toBe("clases-invalidas");
    expect(codigo({ ...PLAN, clases: 1.5 })).toBe("clases-invalidas");
    expect(codigo({ ...PLAN, clases: 1 })).toBe("ok");
    expect(codigo({ ...PLAN, precio: 0 })).toBe("precio-invalido");
    expect(codigo({ ...PLAN, precio: 100.5 })).toBe("precio-invalido");
    expect(codigo({ ...PLAN, precio: 100_000_001 })).toBe("precio-invalido");
  });
});

describe("precioEnSede", () => {
  it("la sede usa su precio si lo tiene; si no, el general (0011)", () => {
    expect(precioEnSede(pesos(30_000), pesos(28_000))).toBe(28_000);
    expect(precioEnSede(pesos(30_000), undefined)).toBe(30_000);
  });
});
