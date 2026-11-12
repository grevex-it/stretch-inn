// Contratos de los abonos: planes, precios por sede y cuotas.
import { describe, expect, it } from "vitest";
import {
  edicionDePlan,
  fichaDePlan,
  paginaDeCuotas,
  paginaDePlanes,
  pedidoDeCuota,
  pedidoDePrecioDeSede,
} from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
const PLAN = { nombre: "Dos por semana", clasesPorSemana: 2, precio: 30_000 };

describe("pedidos de los abonos", () => {
  it("el plan va con precio en pesos enteros; la edición, con la versión", () => {
    expect(fichaDePlan.parse(PLAN)).toEqual(PLAN);
    expect(fichaDePlan.safeParse({ ...PLAN, precio: 10.5 }).error?.issues[0]?.message).toBe(
      "El precio va en pesos, sin centavos.",
    );
    expect(edicionDePlan.parse({ ...PLAN, version: 2 })).toEqual({ ...PLAN, version: 2 });
  });

  it("el precio de una sede es un entero; la cuota lleva el día de inicio opcional", () => {
    expect(pedidoDePrecioDeSede.parse({ precio: 28_000 })).toEqual({ precio: 28_000 });
    const cuota = { alumnoId: UUID, planId: UUID, sedeId: UUID };
    expect(pedidoDeCuota.parse(cuota)).toEqual(cuota);
    expect(pedidoDeCuota.parse({ ...cuota, desde: "2026-11-30" })).toMatchObject({
      desde: "2026-11-30",
    });
    expect(pedidoDeCuota.safeParse({ ...cuota, desde: "30/11/2026" }).success).toBe(false);
  });
});

describe("respuestas de los abonos", () => {
  it("planes con sus precios de sede, y cuotas con monto, período y si están pagadas", () => {
    const planes = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        {
          ...PLAN,
          id: UUID,
          activo: true,
          version: 1,
          preciosDeSede: [{ sedeId: UUID, precio: 28_000 }],
        },
      ],
    };
    expect(paginaDePlanes.parse(planes)).toEqual(planes);
    const cuotas = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        {
          id: UUID,
          alumnoId: UUID,
          planId: UUID,
          sedeId: UUID,
          desde: "2026-11-30",
          hasta: "2026-12-28",
          monto: 28_000,
          pagadaEn: null,
        },
      ],
    };
    expect(paginaDeCuotas.parse(cuotas)).toEqual(cuotas);
  });
});
