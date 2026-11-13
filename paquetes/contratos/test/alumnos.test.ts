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

  it("pide nombre y apellido; revisa email y fecha", () => {
    expect(fichaDeAlumno.safeParse({ ...ficha, nombre: " " }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, apellido: "" }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, email: "ana" }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, fechaNacimiento: "12/04/1990" }).success).toBe(
      false,
    );
  });

  it("el celular es opcional (pendiente de completar, 0022)", () => {
    expect(fichaDeAlumno.parse({ ...ficha, telefono: null }).telefono).toBeNull();
    expect(fichaDeAlumno.parse({ ...ficha, telefono: "" }).telefono).toBe("");
  });

  it("el número de socio y la fecha de inicio son opcionales; si vienen, se revisan", () => {
    const completa = { ...ficha, numeroDeSocio: 283, fechaDeInicio: "2024-03-01" };
    expect(fichaDeAlumno.parse(completa)).toEqual(completa);
    expect(fichaDeAlumno.safeParse({ ...ficha, numeroDeSocio: 0 }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, numeroDeSocio: 1.5 }).success).toBe(false);
    expect(fichaDeAlumno.safeParse({ ...ficha, fechaDeInicio: "01/03/2024" }).success).toBe(false);
  });

  it("el profe asignado es opcional: un uuid o null", () => {
    expect(fichaDeAlumno.parse({ ...ficha, profeId: UUID }).profeId).toBe(UUID);
    expect(fichaDeAlumno.parse({ ...ficha, profeId: null }).profeId).toBeNull();
    expect(fichaDeAlumno.safeParse({ ...ficha, profeId: "lore" }).success).toBe(false);
  });

  it("la edición lleva la versión que se vio", () => {
    expect(edicionDeAlumno.safeParse(ficha).success).toBe(false);
    expect(edicionDeAlumno.parse({ ...ficha, version: 3 })).toEqual({ ...ficha, version: 3 });
  });
});

describe("alumno", () => {
  it("la respuesta trae la ficha con id, número de socio, estado, baja y versión", () => {
    const respuesta = {
      ...ficha,
      id: UUID,
      numeroDeSocio: 283,
      fechaDeInicio: null,
      profeId: null,
      activo: true,
      bajaEn: null,
      pendienteDeCompletar: false,
      version: 1,
    };
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
