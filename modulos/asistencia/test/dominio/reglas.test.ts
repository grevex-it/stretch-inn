// Las reglas de recuperación de una sede (0020), sin base.
import { describe, expect, it } from "vitest";
import { aTiempo, limpiarReglas, REGLAS_POR_DEFECTO } from "../../src/dominio/reglas.ts";

describe("limpiarReglas", () => {
  it("las de Río Tercero son las de una sede sin configurar", () => {
    expect(REGLAS_POR_DEFECTO).toEqual({
      anticipacionMinutos: 0,
      maximoPorAbono: 4,
      sinAbono: false,
    });
    expect(limpiarReglas(REGLAS_POR_DEFECTO)).toEqual({ ok: true, valor: REGLAS_POR_DEFECTO });
  });

  it("anticipación de 0 a una semana y máximo de 0 a 100, enteros", () => {
    const codigo = (cambios: Partial<typeof REGLAS_POR_DEFECTO>) => {
      const resultado = limpiarReglas({ ...REGLAS_POR_DEFECTO, ...cambios });
      return resultado.ok ? "ok" : resultado.error.codigo;
    };
    expect(codigo({ anticipacionMinutos: 7 * 24 * 60 })).toBe("ok");
    expect(codigo({ anticipacionMinutos: 7 * 24 * 60 + 1 })).toBe("reglas-invalidas");
    expect(codigo({ anticipacionMinutos: -1 })).toBe("reglas-invalidas");
    expect(codigo({ maximoPorAbono: 0 })).toBe("ok");
    expect(codigo({ maximoPorAbono: 101 })).toBe("reglas-invalidas");
    expect(codigo({ maximoPorAbono: 1.5 })).toBe("reglas-invalidas");
  });
});

describe("aTiempo", () => {
  const empieza = new Date("2026-11-30T21:30:00Z");
  const antes = (minutos: number) => new Date(empieza.getTime() - minutos * 60_000);

  it("con anticipación 0, hasta que empieza la clase", () => {
    expect(aTiempo(empieza, antes(1), 0)).toBe(true);
    expect(aTiempo(empieza, empieza, 0)).toBe(false);
  });

  it("con una hora, hasta una hora antes", () => {
    expect(aTiempo(empieza, antes(60), 60)).toBe(true);
    expect(aTiempo(empieza, antes(59), 60)).toBe(false);
  });
});
