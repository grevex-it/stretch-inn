// Reglas del equipo: a quién se puede resetear o bloquear, y qué pide un alta. Unitarios, sin base.
import { id, type Permiso, type SedeId } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import { puedeCambiarPermisosDe, puedeGestionarA, validarAlta } from "../../src/dominio/equipo.ts";
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

describe("puedeCambiarPermisosDe: roles y ajustes de otro, en una sede", () => {
  const encargado = {
    usuarioId: "encargado",
    permisos: porSede([[NORTE, ["usuarios.gestionar", "caja.ver", "caja.cobrar"]]]),
  };
  const profe = { usuarioId: "profe", permisos: porSede([[NORTE, ["caja.cobrar"]]]) };
  const enNorte = { sedeId: NORTE, esDueno: false };

  it("con usuarios.gestionar en esa sede, a alguien con menos permisos", () => {
    expect(puedeCambiarPermisosDe(encargado, profe, enNorte)).toEqual({ ok: true, valor: null });
  });

  it("pide usuarios.gestionar en esa sede, no en otra", () => {
    expect(puedeCambiarPermisosDe(encargado, profe, { sedeId: SUR, esDueno: false })).toMatchObject(
      { ok: false, error: { codigo: "sin-gestion-en-la-sede" } },
    );
  });

  it("nunca a uno mismo, tampoco un dueño", () => {
    expect(
      puedeCambiarPermisosDe(encargado, { ...encargado }, { sedeId: NORTE, esDueno: true }),
    ).toMatchObject({ ok: false, error: { codigo: "a-vos-mismo" } });
  });

  it("no a alguien con más permisos, ni con permisos en otra sede", () => {
    const par = { usuarioId: "par", permisos: encargado.permisos };
    const enSur = { usuarioId: "sur", permisos: porSede([[SUR, ["caja.cobrar"]]]) };
    for (const objetivo of [par, enSur]) {
      expect(puedeCambiarPermisosDe(encargado, objetivo, enNorte)).toMatchObject({
        ok: false,
        error: { codigo: "mas-permisos" },
      });
    }
  });

  it("un dueño puede con cualquier otro, también con otro dueño", () => {
    const otroDueno = { usuarioId: "otro", permisos: encargado.permisos };
    expect(puedeCambiarPermisosDe(encargado, otroDueno, { sedeId: NORTE, esDueno: true })).toEqual({
      ok: true,
      valor: null,
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
