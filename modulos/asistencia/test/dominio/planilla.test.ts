// Reglas de la planilla, sin base: cuándo se toma asistencia y qué marcas valen.
import { describe, expect, it } from "vitest";
import { limpiarMarcas, puedeTomar, type Marca } from "../../src/dominio/planilla.ts";

const EMPIEZA = new Date("2026-11-09T21:30:00Z");
const MINUTO = 60_000;

describe("puedeTomar", () => {
  it("se toma desde 60 minutos antes del inicio y sin límite después, para corregir", () => {
    const fecha = { cancelada: false, empiezaEn: EMPIEZA };
    expect(puedeTomar(fecha, new Date(EMPIEZA.getTime() - 60 * MINUTO)).ok).toBe(true);
    expect(puedeTomar(fecha, new Date(EMPIEZA.getTime() + 30 * 86_400_000)).ok).toBe(true);
    expect(puedeTomar(fecha, new Date(EMPIEZA.getTime() - 61 * MINUTO))).toEqual({
      ok: false,
      error: {
        codigo: "todavia-no-empieza",
        mensaje: "Todavía falta para esta clase: la asistencia se toma desde una hora antes.",
      },
    });
  });

  it("una fecha cancelada no tiene asistencia", () => {
    expect(puedeTomar({ cancelada: true, empiezaEn: EMPIEZA }, EMPIEZA)).toMatchObject({
      ok: false,
      error: { codigo: "fecha-cancelada" },
    });
  });
});

describe("limpiarMarcas", () => {
  const marca = (alumnoId: string, estado: Marca["estado"] = "presente"): Marca => ({
    alumnoId,
    estado,
  });

  it("acepta de 1 a 100 marcas de alumnos distintos", () => {
    const marcas = [marca("a"), marca("b", "ausente")];
    expect(limpiarMarcas(marcas)).toEqual({ ok: true, valor: marcas });
    const cien = Array.from({ length: 100 }, (_, i) => marca(String(i)));
    expect(limpiarMarcas(cien).ok).toBe(true);
  });

  it("rechaza una planilla vacía, un alumno repetido y más de 100 marcas", () => {
    expect(limpiarMarcas([])).toMatchObject({ ok: false, error: { codigo: "marcas-vacias" } });
    expect(limpiarMarcas([marca("a"), marca("a", "ausente")])).toMatchObject({
      ok: false,
      error: { codigo: "marcas-repetidas" },
    });
    const muchas = Array.from({ length: 101 }, (_, i) => marca(String(i)));
    expect(limpiarMarcas(muchas)).toMatchObject({
      ok: false,
      error: { codigo: "demasiadas-marcas" },
    });
  });
});
