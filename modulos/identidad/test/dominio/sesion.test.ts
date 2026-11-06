// Reglas de la sesión de la 0017: vencimiento, clave nueva y sede activa. Unitarios, sin base.
import { id, type Permiso, type SedeId } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import type { PermisosPorSede } from "../../src/dominio/permisos.ts";
import {
  elegirSedeActiva,
  permisosDeLaSedeActiva,
  sesionVigente,
  validarClaveNueva,
} from "../../src/dominio/sesion.ts";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const NORTE = id<"Sede">("norte");
const SUR = id<"Sede">("sur");

function porSede(entradas: [SedeId, Permiso[]][]): PermisosPorSede {
  return new Map(entradas.map(([sede, permisos]) => [sede, new Set(permisos)]));
}

describe("sesionVigente: 12 horas sin uso o 7 días en total", () => {
  const creadaEn = new Date("2026-11-05T10:00:00Z");

  it("sigue vigente si se usó hace menos de 12 horas", () => {
    const ultimoUsoEn = new Date(creadaEn.getTime() + HORA);
    const ahora = new Date(ultimoUsoEn.getTime() + 12 * HORA - 1);
    expect(sesionVigente({ creadaEn, ultimoUsoEn }, ahora)).toBe(true);
  });

  it("vence a las 12 horas sin uso", () => {
    const ahora = new Date(creadaEn.getTime() + 12 * HORA);
    expect(sesionVigente({ creadaEn, ultimoUsoEn: creadaEn }, ahora)).toBe(false);
  });

  it("vence a los 7 días aunque se use todo el tiempo", () => {
    const ahora = new Date(creadaEn.getTime() + 7 * DIA);
    const ultimoUsoEn = new Date(ahora.getTime() - 1);
    expect(sesionVigente({ creadaEn, ultimoUsoEn }, ahora)).toBe(false);
  });
});

describe("validarClaveNueva: mínimo 10 caracteres, sin reglas de composición", () => {
  it("acepta 10 caracteres cualesquiera", () => {
    expect(validarClaveNueva("aaaaaaaaaa").ok).toBe(true);
  });

  it("rechaza 9 caracteres con un mensaje para el usuario", () => {
    const resultado = validarClaveNueva("aaaaaaaaa");
    expect(resultado).toEqual({
      ok: false,
      error: {
        codigo: "clave-corta",
        mensaje: "La contraseña tiene que tener al menos 10 caracteres.",
      },
    });
  });

  it("cuenta caracteres y no bytes: 10 emojis alcanzan", () => {
    expect(validarClaveNueva("🙂".repeat(10)).ok).toBe(true);
    expect(validarClaveNueva("🙂".repeat(9)).ok).toBe(false);
  });
});

describe("elegirSedeActiva", () => {
  const dosSedes = porSede([
    [NORTE, ["caja.ver"]],
    [SUR, ["caja.ver"]],
  ]);

  it("la primera vez, con varias sedes, entra a «todas mis sedes»", () => {
    expect(elegirSedeActiva(null, dosSedes)).toEqual({
      ok: true,
      valor: { sede: "todas", cambiada: false },
    });
  });

  it("con una sola sede entra a esa sede: el selector no aparece", () => {
    const una = porSede([[NORTE, ["caja.ver"]]]);
    expect(elegirSedeActiva(null, una)).toEqual({
      ok: true,
      valor: { sede: NORTE, cambiada: false },
    });
    expect(elegirSedeActiva("todas", una)).toEqual({
      ok: true,
      valor: { sede: NORTE, cambiada: false },
    });
  });

  it("respeta la sede elegida si sigue teniendo permisos en ella", () => {
    expect(elegirSedeActiva(SUR, dosSedes)).toEqual({
      ok: true,
      valor: { sede: SUR, cambiada: false },
    });
  });

  it("si le quitaron los permisos en la sede elegida, lo pasa a otra y lo avisa", () => {
    const soloNorte = porSede([
      [NORTE, ["caja.ver"]],
      [SUR, []],
    ]);
    expect(elegirSedeActiva(SUR, soloNorte)).toEqual({
      ok: true,
      valor: { sede: NORTE, cambiada: true },
    });
  });

  it("sin permisos en ninguna sede no puede trabajar en el centro", () => {
    expect(elegirSedeActiva(null, porSede([[NORTE, []]]))).toMatchObject({
      ok: false,
      error: { codigo: "sin-permisos" },
    });
  });
});

describe("permisosDeLaSedeActiva: el contexto se arma solo con esa sede", () => {
  const permisos = porSede([
    [NORTE, ["caja.ver"]],
    [SUR, ["caja.cobrar"]],
  ]);

  it("con una sede elegida, deja solo los permisos de esa sede", () => {
    expect([...permisosDeLaSedeActiva(permisos, SUR).keys()]).toEqual([SUR]);
  });

  it("con «todas mis sedes», deja todos", () => {
    expect([...permisosDeLaSedeActiva(permisos, "todas").keys()]).toEqual([NORTE, SUR]);
  });
});
