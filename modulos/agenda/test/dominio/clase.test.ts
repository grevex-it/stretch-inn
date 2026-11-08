// La ficha de una clase semanal: limpieza y validación, sin base.
import { describe, expect, it } from "vitest";
import { limpiarClase, type DatosDeClase } from "../../src/dominio/clase.ts";

const STRETCHING: DatosDeClase = {
  nombre: "Stretching",
  dia: 1,
  hora: "18:30",
  duracionMinutos: 60,
  cupo: 12,
};

describe("limpiarClase", () => {
  it("recorta el nombre y acepta una clase válida", () => {
    expect(limpiarClase({ ...STRETCHING, nombre: "  Stretching  " })).toEqual({
      ok: true,
      valor: STRETCHING,
    });
  });

  it.each([
    [{ nombre: " " }, "nombre-vacio"],
    [{ dia: 0 }, "dia-invalido"],
    [{ dia: 8 }, "dia-invalido"],
    [{ dia: 1.5 }, "dia-invalido"],
    [{ hora: "24:00" }, "hora-invalida"],
    [{ hora: "9:00" }, "hora-invalida"],
    [{ hora: "18:60" }, "hora-invalida"],
    [{ duracionMinutos: 10 }, "duracion-invalida"],
    [{ duracionMinutos: 241 }, "duracion-invalida"],
    [{ cupo: 0 }, "cupo-invalido"],
    [{ cupo: 501 }, "cupo-invalido"],
    [{ cupo: 2.5 }, "cupo-invalido"],
  ] as const)("rechaza %o con %s", (cambio, codigo) => {
    expect(limpiarClase({ ...STRETCHING, ...cambio })).toMatchObject({
      ok: false,
      error: { codigo },
    });
  });

  it("una clase puede terminar pasada la medianoche del mismo día", () => {
    expect(limpiarClase({ ...STRETCHING, hora: "23:30", duracionMinutos: 90 }).ok).toBe(true);
  });
});
