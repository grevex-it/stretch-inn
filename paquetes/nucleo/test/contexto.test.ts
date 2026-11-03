import { describe, expect, it } from "vitest";
import {
  id,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Permiso,
  type SedeId,
} from "../src/index.ts";

const norte = id<"Sede">("sede-norte");
const sur = id<"Sede">("sede-sur");

function contexto(permisos: [SedeId, Permiso[]][]): ContextoCentro {
  return {
    centroId: id<"Centro">("centro-1"),
    actor: { tipo: "usuario", usuarioId: id<"Usuario">("usuario-1") },
    permisosPorSede: new Map(permisos.map(([sede, lista]) => [sede, new Set(lista)])),
  };
}

describe("puede", () => {
  it("es verdadero solo si el permiso está en esa sede", () => {
    const ctx = contexto([
      [norte, ["caja.ver", "caja.cobrar"]],
      [sur, ["caja.ver"]],
    ]);
    expect(puede(ctx, "caja.cobrar", norte)).toBe(true);
    expect(puede(ctx, "caja.cobrar", sur)).toBe(false);
  });

  it("es falso en una sede donde no tiene ningún permiso", () => {
    const ctx = contexto([[norte, ["caja.ver"]]]);
    expect(puede(ctx, "caja.ver", sur)).toBe(false);
  });
});

describe("sedesVisibles", () => {
  it("son las sedes donde tiene algún permiso", () => {
    const ctx = contexto([
      [norte, ["agenda.ver-propias"]],
      [sur, []],
    ]);
    expect(sedesVisibles(ctx)).toEqual([norte]);
  });

  it("sin permisos no ve ninguna sede", () => {
    expect(sedesVisibles(contexto([]))).toEqual([]);
  });
});

describe("actor", () => {
  it("distingue a un usuario del centro de un operador de soporte de GREVEX", () => {
    const soporte: ContextoCentro = {
      ...contexto([[norte, ["caja.ver"]]]),
      actor: { tipo: "soporte", operadorId: id<"Operador">("operador-1") },
    };
    expect(soporte.actor.tipo).toBe("soporte");
    expect(puede(soporte, "caja.ver", norte)).toBe(true);
  });
});
