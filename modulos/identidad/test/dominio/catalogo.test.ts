import { describe, expect, it } from "vitest";
import {
  crearCatalogo,
  PERMISOS_IDENTIDAD,
  plantillasDelSistema,
} from "../../src/dominio/catalogo.ts";

const caja = {
  seccion: "Caja",
  permisos: [
    { permiso: "caja.ver", descripcion: "Ver los cobros" },
    { permiso: "caja.cobrar", descripcion: "Registrar cobros" },
  ],
} as const;

describe("crearCatalogo", () => {
  it("junta los permisos que declara cada módulo, agrupados por sección", () => {
    const catalogo = crearCatalogo([PERMISOS_IDENTIDAD, caja]);
    expect(catalogo.secciones.map((seccion) => seccion.seccion)).toEqual([
      "Usuarios y roles",
      "Caja",
    ]);
    expect(catalogo.todos).toEqual([
      "usuarios.ver",
      "usuarios.gestionar",
      "roles.gestionar",
      "caja.ver",
      "caja.cobrar",
    ]);
  });

  it("rechaza un permiso repetido entre módulos", () => {
    expect(() => crearCatalogo([caja, caja])).toThrow(/caja\.ver.*repetido/);
  });

  it("rechaza un permiso que no tiene la forma modulo.accion", () => {
    const mal = { seccion: "Mal", permisos: [{ permiso: "Caja.Ver" as const, descripcion: "x" }] };
    expect(() => crearCatalogo([mal])).toThrow(/Caja\.Ver.*forma/);
  });
});

describe("plantillasDelSistema", () => {
  it("el dueño tiene todos los permisos del catálogo", () => {
    const catalogo = crearCatalogo([PERMISOS_IDENTIDAD, caja]);
    const [duenio] = plantillasDelSistema(catalogo);
    expect(duenio).toEqual({ nombre: "Dueño", permisos: catalogo.todos });
  });
});
