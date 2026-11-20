// Contratos de los profes y sus tarifas (0024).
import { describe, expect, it } from "vitest";
import {
  paginaDeTarifas,
  pedidoDeTarifa,
  pedidoDeTarifas,
  pedidoDeTipoDeProfe,
} from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";

describe("profes y tarifas", () => {
  it("el tipo es empleado o socio", () => {
    expect(pedidoDeTipoDeProfe.parse({ tipo: "socio" })).toEqual({ tipo: "socio" });
    expect(pedidoDeTipoDeProfe.safeParse({ tipo: "jefe" }).success).toBe(false);
  });

  it("la tarifa lleva su alcance (null: todos), un monto entero y desde cuándo", () => {
    const pedido = { sedeId: null, profeId: UUID, monto: 15_000, desde: "2026-12-01" };
    expect(pedidoDeTarifa.parse(pedido)).toEqual(pedido);
    expect(pedidoDeTarifa.safeParse({ ...pedido, monto: 1.5 }).success).toBe(false);
    expect(pedidoDeTarifas.parse({})).toEqual({ pagina: 1, porPagina: 50, sedeId: null });
    expect(pedidoDeTarifas.parse({ sede: UUID }).sedeId).toBe(UUID);
    const pagina = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        { id: UUID, sedeId: null, profeId: null, monto: 10_000, desde: "2026-11-20", hasta: null },
      ],
    };
    expect(paginaDeTarifas.parse(pagina)).toEqual(pagina);
  });
});
