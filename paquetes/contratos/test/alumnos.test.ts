// Contratos de alumnos (ver docs/decisiones/0011): lo que el panel manda y la API acepta.
import { describe, expect, it } from "vitest";
import {
  alumno,
  edicionDeAlumno,
  fichaDeAlumno,
  pedidoDeAlumnos,
  saludDeAlumno,
} from "../src/index.ts";

const UUID = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
const ficha = {
  nombre: "Ana",
  apellido: "Pérez",
  telefono: "11 5555-1234",
  documento: null,
  email: null,
  fechaNacimiento: null,
  notas: "",
};

describe("pedidoDeAlumnos", () => {
  it("por defecto: página 1, sin búsqueda y sin bajas", () => {
    expect(pedidoDeAlumnos.parse({})).toEqual({ pagina: 1, porPagina: 50 });
  });

  it("lee la búsqueda recortada y si incluye las bajas", () => {
    expect(pedidoDeAlumnos.parse({ pagina: "2", buscar: " ana ", bajas: "si" })).toEqual({
      pagina: 2,
      porPagina: 50,
      buscar: "ana",
      conBajas: true,
    });
  });

  it("una búsqueda vacía es como no buscar", () => {
    expect(pedidoDeAlumnos.parse({ buscar: "  " })).toEqual({ pagina: 1, porPagina: 50 });
  });
});

describe("fichaDeAlumno", () => {
  it("acepta lo opcional vacío o en null", () => {
    expect(fichaDeAlumno.parse(ficha)).toEqual(ficha);
    expect(
      fichaDeAlumno.parse({ ...ficha, documento: "", email: "", fechaNacimiento: "" }),
    ).toEqual({ ...ficha, documento: "", email: "", fechaNacimiento: "" });
  });

  it("pide nombre, apellido y teléfono; revisa email y fecha", () => {
    expect(fichaDeAlumno.safeParse({ ...ficha, nombre: " " }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, apellido: "" }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, telefono: "" }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, email: "ana" }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, fechaNacimiento: "12/04/1990" }).success).toBe(
      false,
    );
  });

  it("la edición lleva la versión que se vio", () => {
    expect(edicionDeAlumno.safeParse(ficha).success).toBe(false);
    expect(edicionDeAlumno.parse({ ...ficha, version: 3 })).toEqual({ ...ficha, version: 3 });
  });
});

describe("alumno", () => {
  it("la respuesta trae la ficha con id, estado y versión", () => {
    const respuesta = { ...ficha, id: UUID, activo: true, version: 1 };
    expect(alumno.parse(respuesta)).toEqual(respuesta);
    expect(alumno.safeParse({ ...respuesta, version: undefined }).success).toBe(false);
  });
});

describe("datos de salud", () => {
  it("las patologías con su versión; hasta 4000 caracteres", () => {
    expect(saludDeAlumno.parse({ patologias: "Escoliosis.", version: 0 })).toEqual({
      patologias: "Escoliosis.",
      version: 0,
    });
    expect(saludDeAlumno.safeParse({ patologias: "x".repeat(4001), version: 0 }).success).toBe(
      false,
    );
    expect(saludDeAlumno.safeParse({ patologias: "x" }).success).toBe(false);
  });
});
