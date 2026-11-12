// Contratos de la caja: cobrar con clave de idempotencia, anular y el día de caja.
import { describe, expect, it } from "vitest";
import { diaDeCaja, pedidoDeAnulacion, pedidoDeCobro, pedidoDelDia } from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";

describe("pedidos de la caja", () => {
  it("el cobro lleva la cuota, el medio y la clave de idempotencia (regla 7)", () => {
    const cobro = { cuotaId: UUID, medio: "efectivo", claveIdempotencia: "cobro-12345" };
    expect(pedidoDeCobro.parse(cobro)).toEqual(cobro);
    expect(pedidoDeCobro.safeParse({ ...cobro, medio: "mercadopago" }).success).toBe(false);
    expect(pedidoDeCobro.safeParse({ ...cobro, medio: "cheque" }).error?.issues[0]?.message).toBe(
      "Elegí el medio de pago.",
    );
    expect(pedidoDeCobro.safeParse({ cuotaId: UUID, medio: "efectivo" }).success).toBe(false);
  });

  it("anular pide motivo; el día de caja, sede y día", () => {
    expect(pedidoDeAnulacion.parse({ motivo: "error" })).toEqual({ motivo: "error" });
    expect(pedidoDelDia.parse({ sede: UUID, dia: "2026-11-09" })).toEqual({
      pagina: 1,
      porPagina: 50,
      sedeId: UUID,
      dia: "2026-11-09",
    });
  });
});

describe("el día de caja", () => {
  it("una página de pagos y lo cobrado", () => {
    const dia = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      cobrado: 30_000,
      elementos: [
        {
          id: UUID,
          sedeId: UUID,
          alumnoId: UUID,
          cuotaId: UUID,
          monto: 30_000,
          medio: "efectivo",
          registradoEn: "2026-11-09T15:00:00.000Z",
          anuladoEn: null,
          motivoAnulacion: null,
        },
      ],
    };
    expect(diaDeCaja.parse(dia)).toEqual(dia);
  });
});
