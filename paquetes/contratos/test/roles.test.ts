// Contratos de los roles a medida, las asignaciones y los ajustes del equipo (0007).
import { describe, expect, it } from "vitest";
import {
  catalogoDePermisos,
  edicionDeRol,
  fichaDeRol,
  paginaDeRoles,
  pedidoDeAjuste,
  pedidoDeAsignacion,
  pedidoDeRol,
  permisosDeIntegrante,
} from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";

describe("pedidos de roles", () => {
  it("un rol lleva nombre y permisos; la edición, también la versión", () => {
    const rol = { nombre: "  Profe sin bajas ", permisos: ["personas.ver", "caja.cobrar"] };
    expect(pedidoDeRol.parse(rol)).toEqual({ ...rol, nombre: "Profe sin bajas" });
    expect(edicionDeRol.parse({ ...rol, version: 2 })).toMatchObject({ version: 2 });
    expect(pedidoDeRol.safeParse({ ...rol, nombre: " " }).error?.issues[0]?.message).toBe(
      "Escribí el nombre del rol.",
    );
  });

  it("cada permiso tiene la forma modulo.accion", () => {
    const mal = pedidoDeRol.safeParse({ nombre: "Rol", permisos: ["Caja"] });
    expect(mal.error?.issues[0]?.message).toBe("Ese permiso no existe.");
  });

  it("asignar pide sede y rol; ajustar, sede, permiso y si es extra o quitado", () => {
    expect(pedidoDeAsignacion.parse({ sedeId: UUID, rolId: UUID })).toEqual({
      sedeId: UUID,
      rolId: UUID,
    });
    const ajuste = { sedeId: UUID, permiso: "usuarios.gestionar", tipo: "extra" };
    expect(pedidoDeAjuste.parse(ajuste)).toEqual(ajuste);
    expect(pedidoDeAjuste.safeParse({ ...ajuste, tipo: "otro" }).success).toBe(false);
  });
});

describe("respuestas de roles", () => {
  it("la lista de roles dice de qué plantilla salió cada uno", () => {
    const pagina = { pagina: 1, porPagina: 50, total: 1, elementos: [] };
    const rol = { id: UUID, nombre: "Profesor", plantilla: "profesor" };
    expect(paginaDeRoles.parse({ ...pagina, elementos: [rol] }).elementos).toEqual([rol]);
    const propio = { ...rol, plantilla: null };
    expect(paginaDeRoles.parse({ ...pagina, elementos: [propio] }).elementos).toEqual([propio]);
  });

  it("la ficha de un rol, el catálogo y los permisos de un integrante con su origen", () => {
    const ficha = {
      id: UUID,
      nombre: "Profe",
      plantilla: null,
      permisos: ["caja.cobrar"],
      version: 1,
    };
    expect(fichaDeRol.parse(ficha)).toEqual(ficha);
    const catalogo = {
      secciones: [{ seccion: "Caja", permisos: [{ permiso: "caja.ver", descripcion: "Ver" }] }],
    };
    expect(catalogoDePermisos.parse(catalogo)).toEqual(catalogo);
    const permisos = {
      asignaciones: [{ sedeId: UUID, rolId: UUID, rol: "Profesor" }],
      permisos: [
        { sedeId: UUID, permiso: "caja.cobrar", roles: ["Profesor"], ajuste: null, efectivo: true },
        {
          sedeId: UUID,
          permiso: "caja.anular",
          roles: ["Profesor"],
          ajuste: "quitado",
          efectivo: false,
        },
      ],
    };
    expect(permisosDeIntegrante.parse(permisos)).toEqual(permisos);
  });
});
