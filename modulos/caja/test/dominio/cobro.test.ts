// Reglas del cobro, sin base: medios de pago, clave de idempotencia, motivo y el día de caja.
import { describe, expect, it } from "vitest";
import { diaDeCaja, limpiarClave, limpiarMotivo, medioValido } from "../../src/dominio/cobro.ts";

describe("medioValido", () => {
  it("[SUPUESTO] efectivo, transferencia, débito, crédito o Mercado Pago", () => {
    for (const medio of ["efectivo", "transferencia", "debito", "credito", "mercadopago"]) {
      expect(medioValido(medio)).toBe(true);
    }
    expect(medioValido("cheque")).toBe(false);
  });
});

describe("limpiarClave", () => {
  it("la clave de idempotencia va de 8 a 100 caracteres (regla 7)", () => {
    expect(limpiarClave(" cobro-123 ")).toEqual({ ok: true, valor: "cobro-123" });
    expect(limpiarClave("corta")).toMatchObject({ ok: false, error: { codigo: "clave-invalida" } });
    expect(limpiarClave("x".repeat(101))).toMatchObject({
      ok: false,
      error: { codigo: "clave-invalida" },
    });
  });
});

describe("limpiarMotivo", () => {
  it("anular un pago pide un motivo", () => {
    expect(limpiarMotivo("  se cobró dos veces ")).toEqual({
      ok: true,
      valor: "se cobró dos veces",
    });
    expect(limpiarMotivo(" ")).toMatchObject({ ok: false, error: { codigo: "motivo-vacio" } });
  });
});

describe("diaDeCaja", () => {
  it("el día de caja va de medianoche a medianoche en la zona del centro, en UTC", () => {
    expect(diaDeCaja("2026-11-09", "America/Argentina/Buenos_Aires")).toEqual({
      desde: new Date("2026-11-09T03:00:00Z"),
      hasta: new Date("2026-11-10T03:00:00Z"),
    });
  });
});
