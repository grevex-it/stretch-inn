// Contratos de la agenda: la forma de los pedidos y las respuestas.
import { describe, expect, it } from "vitest";
import {
  edicionDeClase,
  fichaDeClase,
  paginaDeOcurrencias,
  pedidoDeClases,
  pedidoDeOcurrencias,
} from "../src/index.ts";

const SEDE = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
const CLASE = { nombre: "Stretching", dia: 1, hora: "18:30", duracionMinutos: 60, cupo: 12 };

describe("pedidos de la agenda", () => {
  it("la lista de clases va paginada, con la sede opcional", () => {
    expect(pedidoDeClases.parse({})).toEqual({ pagina: 1, porPagina: 50 });
    expect(pedidoDeClases.parse({ pagina: "2", sede: SEDE })).toEqual({
      pagina: 2,
      porPagina: 50,
      sedeId: SEDE,
    });
  });

  it("la semana pide sede y fecha de inicio, y va paginada", () => {
    expect(pedidoDeOcurrencias.parse({ sede: SEDE, desde: "2026-11-09" })).toEqual({
      pagina: 1,
      porPagina: 50,
      sedeId: SEDE,
      desde: "2026-11-09",
    });
    expect(pedidoDeOcurrencias.safeParse({ sede: SEDE }).success).toBe(false);
    expect(pedidoDeOcurrencias.safeParse({ sede: SEDE, desde: "9/11" }).success).toBe(false);
  });

  it("el alta lleva la sede; la edición, la versión y no la sede", () => {
    expect(fichaDeClase.parse({ ...CLASE, sedeId: SEDE })).toEqual({ ...CLASE, sedeId: SEDE });
    expect(edicionDeClase.parse({ ...CLASE, version: 3, sedeId: SEDE })).toEqual({
      ...CLASE,
      version: 3,
    });
    expect(fichaDeClase.safeParse({ ...CLASE, dia: "lunes", sedeId: SEDE }).success).toBe(false);
  });

  it("las fechas viajan en UTC, como texto ISO", () => {
    const pagina = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        {
          id: SEDE,
          claseId: SEDE,
          nombre: "Stretching",
          cupo: 12,
          fecha: "2026-11-09",
          empiezaEn: "2026-11-09T21:30:00.000Z",
          terminaEn: "2026-11-09T22:30:00.000Z",
          cancelada: false,
        },
      ],
    };
    expect(paginaDeOcurrencias.parse(pagina)).toEqual(pagina);
  });
});
