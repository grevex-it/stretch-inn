// Reglas del equipo: a quién se puede resetear o bloquear, y qué pide un alta. Unitarios, sin base.
import { id, type Permiso, type SedeId } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import { puedeGestionarA, validarAlta } from "../../src/dominio/equipo.ts";
import type { PermisosPorSede } from "../../src/dominio/permisos.ts";

const NORTE = id<"Sede">("norte");
const SUR = id<"Sede">("sur");

function porSede(entradas: [SedeId, Permiso[]][]): PermisosPorSede {
  return new Map(entradas.map(([sede, permisos]) => [sede, new Set(permisos)]));
}

const admin = {
  usuarioId: "admin",
  permisos: porSede([[NORTE, ["usuarios.gestionar", "caja.ver"]]]),
};

describe("puedeGestionarA: solo a quien tiene menos permisos (0017)", () => {
  it("deja gestionar a alguien con menos permisos", () => {
    const recepcion = { usuarioId: "ana", permisos: porSede([[NORTE, ["caja.ver"]]]) };
    expect(puedeGestionarA(admin, recepcion)).toEqual({ ok: true, valor: null });
  });

  it("no deja gestionarse a uno mismo", () => {
    const resultado = puedeGestionarA(admin, { ...admin });
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "a-vos-mismo" } });
  });

  it("no deja gestionar a un par con los mismos permisos", () => {
    const par = { usuarioId: "otro", permisos: admin.permisos };
    expect(puedeGestionarA(admin, par)).toMatchObject({
      ok: false,
      error: { codigo: "mas-permisos" },
    });
  });

  it("no deja gestionar a quien tiene permisos en una sede donde uno no tiene", () => {
    const enSur = { usuarioId: "ana", permisos: porSede([[SUR, ["caja.ver"]]]) };
    expect(puedeGestionarA(admin, enSur)).toMatchObject({
      ok: false,
      error: { codigo: "mas-permisos" },
    });
  });
});

describe("validarAlta", () => {
  it("recorta el nombre y saca las sedes repetidas", () => {
    expect(validarAlta({ nombre: "  Ana  ", sedeIds: ["norte", "norte", "sur"] })).toEqual({
      ok: true,
      valor: { nombre: "Ana", sedeIds: ["norte", "sur"] },
    });
  });

  it("pide un nombre", () => {
    expect(validarAlta({ nombre: "   ", sedeIds: ["norte"] })).toMatchObject({
      ok: false,
      error: { codigo: "nombre-vacio" },
    });
  });

  it("pide al menos una sede", () => {
    expect(validarAlta({ nombre: "Ana", sedeIds: [] })).toMatchObject({
      ok: false,
      error: { codigo: "sin-sedes" },
    });
  });
});
