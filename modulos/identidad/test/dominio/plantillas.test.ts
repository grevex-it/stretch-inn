import { describe, expect, it } from "vitest";
import { crearCatalogo, PERMISOS_IDENTIDAD } from "../../src/dominio/catalogo.ts";
import { plantillasDelSistema } from "../../src/dominio/plantillas.ts";

const alumnos = {
  seccion: "Alumnos",
  permisos: [
    { permiso: "personas.ver", descripcion: "Ver los alumnos" },
    { permiso: "personas.editar", descripcion: "Editar los alumnos" },
  ],
} as const;

describe("plantillasDelSistema", () => {
  it("vienen Dueño, Encargado, Profesor, Recepción y Contaduría, cada una con su marca", () => {
    const plantillas = plantillasDelSistema(crearCatalogo([PERMISOS_IDENTIDAD]));
    expect(plantillas.map(({ nombre, plantilla }) => [nombre, plantilla])).toEqual([
      ["Dueño", "dueno"],
      ["Encargado", "encargado"],
      ["Profesor", "profesor"],
      ["Recepción", "recepcion"],
      ["Contaduría", "contadora"],
    ]);
  });

  it("el dueño tiene todos los permisos del catálogo", () => {
    const catalogo = crearCatalogo([PERMISOS_IDENTIDAD, alumnos]);
    const [dueno] = plantillasDelSistema(catalogo);
    expect(dueno).toEqual({ nombre: "Dueño", plantilla: "dueno", permisos: catalogo.todos });
  });

  it("las demás traen solo los permisos del catálogo que recibe: sin un módulo, sin los suyos", () => {
    const catalogo = crearCatalogo([PERMISOS_IDENTIDAD, alumnos]);
    const permisos = Object.fromEntries(
      plantillasDelSistema(catalogo).map((p) => [p.plantilla, p.permisos]),
    );
    expect(permisos).toEqual({
      dueno: catalogo.todos,
      encargado: ["usuarios.ver", "personas.ver", "personas.editar"],
      profesor: ["personas.ver", "personas.editar"],
      recepcion: ["personas.ver", "personas.editar"],
      contadora: ["usuarios.ver", "personas.ver"],
    });
  });
});
