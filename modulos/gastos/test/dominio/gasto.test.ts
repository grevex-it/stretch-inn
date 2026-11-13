// Las reglas de un gasto (0022): sin base. Montos en pesos enteros (0009).
import { describe, expect, it } from "vitest";
import { limpiarGasto } from "../../src/dominio/gasto.ts";

const GASTO = {
  fecha: "2026-11-10",
  monto: 45_000,
  categoria: "servicios",
  medio: "transferencia",
  descripcion: "  Luz de octubre  ",
  claveIdempotencia: "clave-de-prueba-1",
};
const HOY = new Date("2026-11-13T15:00:00Z");

describe("limpiarGasto", () => {
  it("recorta la descripción y la clave, y deja el monto como Dinero", () => {
    const limpio = limpiarGasto(GASTO, HOY);
    expect(limpio).toEqual({
      ok: true,
      valor: { ...GASTO, descripcion: "Luz de octubre", monto: 45_000 },
    });
  });

  it.each([
    [{ monto: 0 }, "monto-invalido"],
    [{ monto: 1.5 }, "monto-invalido"],
    [{ monto: 100_000_001 }, "monto-invalido"],
    [{ categoria: "viajes" }, "categoria-invalida"],
    [{ medio: "cheque" }, "medio-invalido"],
    [{ fecha: "13/11/2026" }, "fecha-invalida"],
    [{ fecha: "2026-02-30" }, "fecha-invalida"],
    [{ fecha: "2026-11-20" }, "fecha-invalida"],
    [{ descripcion: "x".repeat(501) }, "descripcion-larga"],
    [{ claveIdempotencia: "corta" }, "clave-invalida"],
  ])("rechaza %o con %s", (cambio, codigo) => {
    const limpio = limpiarGasto({ ...GASTO, ...cambio }, HOY);
    expect(!limpio.ok && limpio.error.codigo).toBe(codigo);
  });
});
