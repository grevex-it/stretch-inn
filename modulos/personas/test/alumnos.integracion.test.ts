// Alumnos sobre Postgres real: alta, edición, baja, búsqueda y aislamiento entre centros (0011).
import { type ContextoCentro } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  crearAlumno,
  editarAlumno,
  fijarActivo,
  listarAlumnos,
  obtenerAlumno,
  type DatosDeAlumno,
} from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);

async function alta(ctx: ContextoCentro, datos: Partial<DatosDeAlumno> = {}) {
  const resultado = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, ...datos }));
  if (!resultado.ok) throw new Error(resultado.error.mensaje);
  return resultado.valor.id;
}

describe("crearAlumno", () => {
  it("guarda la ficha limpia: recorta textos y saca puntos del documento", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx, {
      nombre: " Ana ",
      documento: "30.123.456",
      email: " Ana@Ejemplo.com ",
      fechaNacimiento: "1990-04-12",
    });
    const alumno = await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));
    expect(alumno).toEqual({
      ...ANA,
      id,
      nombre: "Ana",
      documento: "30123456",
      email: "ana@ejemplo.com",
      fechaNacimiento: "1990-04-12",
      numeroDeSocio: 1,
      fechaDeInicio: null,
      profeId: null,
      activo: true,
      bajaEn: null,
      pendienteDeCompletar: false,
      version: 1,
    });
  });

  it("no repite un documento dentro del centro, pero sí en otro centro", async () => {
    const ctx = await nuevoCentro();
    await alta(ctx, { documento: "30123456" });
    const repetido = await enContexto(base, ctx, (tx) =>
      crearAlumno(tx, { ...ANA, nombre: "Otra", documento: "30.123.456" }),
    );
    expect(repetido).toMatchObject({ ok: false, error: { codigo: "documento-repetido" } });
    await expect(alta(await nuevoCentro(), { documento: "30123456" })).resolves.toBeTypeOf(
      "string",
    );
  });

  it.each([
    [{ nombre: "  " }, "nombre-vacio"],
    [{ apellido: "" }, "nombre-vacio"],
    [{ telefono: "12" }, "telefono-invalido"],
    [{ fechaNacimiento: "2999-01-01" }, "fecha-invalida"],
  ] as const)("rechaza %o con %s", async (datos, codigo) => {
    const ctx = await nuevoCentro();
    const resultado = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, ...datos }));
    expect(resultado).toMatchObject({ ok: false, error: { codigo } });
  });
});

describe("editarAlumno", () => {
  it("cambia los datos y sube la versión; con una versión vieja avisa del cambio", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx);
    const cambio = { ...ANA, id, version: 1, telefono: "11 4444-0000" };

    const primera = await enContexto(base, ctx, (tx) => editarAlumno(tx, cambio));
    const segunda = await enContexto(base, ctx, (tx) => editarAlumno(tx, cambio));

    expect(primera).toEqual({ ok: true, valor: { version: 2 } });
    expect(segunda).toMatchObject({ ok: false, error: { codigo: "cambio-concurrente" } });
    const alumno = await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));
    expect(alumno?.telefono).toBe("11 4444-0000");
  });

  it("no deja poner el documento de otro alumno del centro, y no cambia nada", async () => {
    const ctx = await nuevoCentro();
    await alta(ctx, { documento: "30123456" });
    const id = await alta(ctx, { nombre: "Otra" });

    const resultado = await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, id, version: 1, nombre: "Otra", documento: "30.123.456" }),
    );

    expect(resultado).toMatchObject({ ok: false, error: { codigo: "documento-repetido" } });
    const alumno = await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));
    expect(alumno).toMatchObject({ documento: null, version: 1 });
  });
});

describe("baja y reactivación", () => {
  it("la baja lo saca de la lista habitual pero no lo borra", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx);
    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: false }));

    const habitual = await enContexto(base, ctx, (tx) => listarAlumnos(tx, PRIMERA));
    const conBajas = await enContexto(base, ctx, (tx) =>
      listarAlumnos(tx, { ...PRIMERA, conBajas: true }),
    );
    expect(habitual.total).toBe(0);
    expect(conBajas.elementos.map((a) => [a.id, a.activo])).toEqual([[id, false]]);

    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: true }));
    expect((await enContexto(base, ctx, (tx) => listarAlumnos(tx, PRIMERA))).total).toBe(1);
  });

  it("un alumno que no existe en el centro da error", async () => {
    const ctx = await nuevoCentro();
    const resultado = await enContexto(base, ctx, (tx) =>
      fijarActivo(tx, { id: randomUUID(), activo: false }),
    );
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "alumno-inexistente" } });
  });
});

describe("listarAlumnos", () => {
  it("ordena por apellido y nombre, y pagina", async () => {
    const ctx = await nuevoCentro();
    await alta(ctx, { nombre: "Bea", apellido: "Zapata" });
    await alta(ctx, { nombre: "Ana", apellido: "Acosta" });
    await alta(ctx, { nombre: "Caro", apellido: "Acosta" });

    const primera = await enContexto(base, ctx, (tx) =>
      listarAlumnos(tx, { pagina: 1, porPagina: 2 }),
    );
    const segunda = await enContexto(base, ctx, (tx) =>
      listarAlumnos(tx, { pagina: 2, porPagina: 2 }),
    );

    expect(primera.total).toBe(3);
    expect(primera.elementos.map((a) => a.nombre)).toEqual(["Ana", "Caro"]);
    expect(segunda.elementos.map((a) => a.nombre)).toEqual(["Bea"]);
  });

  it.each([
    ["por nombre y apellido, sin importar mayúsculas ni acentos", "perez ana"],
    ["por documento, aunque lo escriba con puntos", "30.123"],
    ["por teléfono, aunque lo escriba sin espacios", "55551234"],
  ])("busca %s", async (_caso, buscar) => {
    const ctx = await nuevoCentro();
    await alta(ctx, { documento: "30123456" });
    await alta(ctx, { nombre: "Bea", apellido: "Zapata", telefono: "11 2222-3333" });
    const lista = await enContexto(base, ctx, (tx) => listarAlumnos(tx, { ...PRIMERA, buscar }));
    expect(lista.elementos.map((a) => a.nombre)).toEqual(["Ana"]);
  });

  it("una búsqueda con % o _ no funciona como comodín", async () => {
    const ctx = await nuevoCentro();
    await alta(ctx);
    const lista = await enContexto(base, ctx, (tx) =>
      listarAlumnos(tx, { ...PRIMERA, buscar: "%" }),
    );
    expect(lista.total).toBe(0);
  });
});

describe("aislamiento entre centros", () => {
  it("un centro no ve ni cambia los alumnos de otro", async () => {
    const uno = await nuevoCentro();
    const otro = await nuevoCentro();
    const id = await alta(uno);

    expect((await enContexto(base, otro, (tx) => listarAlumnos(tx, PRIMERA))).total).toBe(0);
    await expect(enContexto(base, otro, (tx) => obtenerAlumno(tx, id))).resolves.toBeUndefined();
    await expect(
      enContexto(base, otro, (tx) => fijarActivo(tx, { id, activo: false })),
    ).resolves.toMatchObject({ ok: false, error: { codigo: "alumno-inexistente" } });
    const propio = await enContexto(base, uno, (tx) => obtenerAlumno(tx, id));
    expect(propio?.activo).toBe(true);
  });
});
