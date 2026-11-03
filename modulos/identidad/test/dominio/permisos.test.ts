// Reglas de permisos de la 0007 y del reset entre pares de la 0017. Unitarios, sin base.
import { id, type Permiso, type SedeId } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import {
  faltantesEnAlgunaSede,
  faltantesParaOtorgar,
  permisosEfectivos,
  tieneAccesoTotal,
  tieneMenosPermisos,
  type PermisosPorSede,
} from "../../src/dominio/permisos.ts";

const NORTE = id<"Sede">("norte");
const SUR = id<"Sede">("sur");

function porSede(entradas: [SedeId, Permiso[]][]): PermisosPorSede {
  return new Map(entradas.map(([sede, permisos]) => [sede, new Set(permisos)]));
}

function comoObjeto(permisos: PermisosPorSede): Record<string, Permiso[]> {
  return Object.fromEntries([...permisos].map(([sede, lista]) => [sede, [...lista].sort()]));
}

describe("permisosEfectivos: roles por sede + extras − quitados", () => {
  it("une los permisos de los roles de cada sede", () => {
    const efectivos = permisosEfectivos(
      [
        { sedeId: NORTE, permisosDelRol: ["caja.ver", "caja.cobrar"] },
        { sedeId: NORTE, permisosDelRol: ["agenda.ver"] },
        { sedeId: SUR, permisosDelRol: ["caja.ver"] },
      ],
      [],
    );
    expect(comoObjeto(efectivos)).toEqual({
      norte: ["agenda.ver", "caja.cobrar", "caja.ver"],
      sur: ["caja.ver"],
    });
  });

  it("los extras suman y los quitados restan, también lo que viene del rol", () => {
    const efectivos = permisosEfectivos(
      [{ sedeId: NORTE, permisosDelRol: ["caja.ver", "caja.cobrar"] }],
      [
        { sedeId: NORTE, permiso: "caja.anular", tipo: "extra" },
        { sedeId: NORTE, permiso: "caja.cobrar", tipo: "quitado" },
      ],
    );
    expect(comoObjeto(efectivos)).toEqual({ norte: ["caja.anular", "caja.ver"] });
  });

  it("si un permiso está como extra y como quitado, gana el quitado", () => {
    const efectivos = permisosEfectivos(
      [],
      [
        { sedeId: NORTE, permiso: "caja.anular", tipo: "quitado" },
        { sedeId: NORTE, permiso: "caja.anular", tipo: "extra" },
      ],
    );
    expect(comoObjeto(efectivos)).toEqual({ norte: [] });
  });

  it("los ajustes son por sede: un extra en Norte no da nada en Sur", () => {
    const efectivos = permisosEfectivos(
      [{ sedeId: SUR, permisosDelRol: ["caja.ver"] }],
      [{ sedeId: NORTE, permiso: "caja.anular", tipo: "extra" }],
    );
    expect(comoObjeto(efectivos)).toEqual({ norte: ["caja.anular"], sur: ["caja.ver"] });
  });
});

describe("nadie da permisos que no tiene (0007, regla 1)", () => {
  const quien = porSede([
    [NORTE, ["caja.ver", "caja.cobrar"]],
    [SUR, ["caja.ver"]],
  ]);

  it("al asignar en una sede, faltan los que no tiene en esa sede", () => {
    expect(faltantesParaOtorgar(quien, NORTE, ["caja.ver", "caja.cobrar"])).toEqual([]);
    expect(faltantesParaOtorgar(quien, SUR, ["caja.ver", "caja.cobrar"])).toEqual(["caja.cobrar"]);
    expect(faltantesParaOtorgar(quien, id<"Sede">("oeste"), ["caja.ver"])).toEqual(["caja.ver"]);
  });

  it("al armar un rol, faltan los que no tiene en ninguna sede", () => {
    expect(faltantesEnAlgunaSede(quien, ["caja.cobrar", "caja.anular"])).toEqual(["caja.anular"]);
  });
});

describe("tieneMenosPermisos: para resetear una contraseña (0017)", () => {
  const encargado = porSede([
    [NORTE, ["caja.ver", "caja.cobrar", "usuarios.gestionar"]],
    [SUR, ["caja.ver"]],
  ]);

  it("es verdadero si el otro tiene un subconjunto en cada sede y al menos uno menos", () => {
    expect(tieneMenosPermisos(porSede([[NORTE, ["caja.ver"]]]), encargado)).toBe(true);
    expect(tieneMenosPermisos(porSede([]), encargado)).toBe(true);
  });

  it("es falso entre pares con los mismos permisos", () => {
    expect(tieneMenosPermisos(encargado, encargado)).toBe(false);
  });

  it("es falso si el otro tiene algún permiso que quien resetea no tiene en esa sede", () => {
    const otro = porSede([[SUR, ["caja.cobrar"]]]);
    expect(tieneMenosPermisos(otro, encargado)).toBe(false);
  });
});

describe("tieneAccesoTotal (0007, regla 2)", () => {
  const catalogo: Permiso[] = ["caja.ver", "caja.cobrar"];

  it("es verdadero con todos los permisos del catálogo en todas las sedes del centro", () => {
    const todo = porSede([
      [NORTE, catalogo],
      [SUR, catalogo],
    ]);
    expect(tieneAccesoTotal(todo, catalogo, [NORTE, SUR])).toBe(true);
  });

  it("es falso si falta un permiso en una sede", () => {
    const casi = porSede([
      [NORTE, catalogo],
      [SUR, ["caja.ver"]],
    ]);
    expect(tieneAccesoTotal(casi, catalogo, [NORTE, SUR])).toBe(false);
  });
});
