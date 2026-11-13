// Contratos de los gastos (0022): la forma de lo que el panel manda y la API responde.
import { describe, expect, it } from "vitest";
import { paginaDeGastos, pedidoDeGasto, pedidoDeGastos } from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
const GASTO = {
  sedeId: UUID,
  fecha: "2026-11-10",
  monto: 45_000,
  categoria: "servicios",
  medio: "transferencia",
  descripcion: "Luz de octubre",
  claveIdempotencia: "clave-de-prueba-1",
};

describe("pedidos de gastos", () => {
  it("el gasto va en pesos enteros, con categoría, medio y clave", () => {
    expect(pedidoDeGasto.parse(GASTO)).toEqual(GASTO);
    expect(pedidoDeGasto.safeParse({ ...GASTO, monto: 1.5 }).success).toBe(false);
    expect(pedidoDeGasto.safeParse({ ...GASTO, categoria: "viajes" }).success).toBe(false);
    expect(pedidoDeGasto.safeParse({ ...GASTO, fecha: "10/11/2026" }).success).toBe(false);
  });

  it("la lista se pide por sede y período", () => {
    expect(pedidoDeGastos.parse({ sede: UUID, desde: "2026-11-01", hasta: "2026-11-30" })).toEqual({
      pagina: 1,
      porPagina: 50,
      sedeId: UUID,
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });
    expect(pedidoDeGastos.safeParse({ sede: UUID, desde: "2026-11-01" }).success).toBe(false);
  });
});

describe("respuesta de gastos", () => {
  it("una página de gastos con lo gastado", () => {
    const pagina = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      gastado: 45_000,
      elementos: [
        {
          id: UUID,
          sedeId: UUID,
          fecha: "2026-11-10",
          monto: 45_000,
          categoria: "servicios",
          medio: "transferencia",
          descripcion: "Luz de octubre",
          registradoEn: "2026-11-13T15:00:00.000Z",
          anuladoEn: null,
          motivoAnulacion: null,
        },
      ],
    };
    expect(paginaDeGastos.parse(pagina)).toEqual(pagina);
  });
});
