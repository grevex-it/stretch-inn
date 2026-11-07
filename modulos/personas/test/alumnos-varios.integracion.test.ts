// Varios alumnos a la vez, para otros módulos que muestran una página de algo con sus alumnos
// (por ejemplo, los inscriptos de una clase) sin consultar uno por uno (regla 8).
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, fijarActivo, obtenerAlumnos } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);

describe("obtenerAlumnos", () => {
  it("trae los alumnos del centro con esos ids, también los de baja", async () => {
    const ctx = await nuevoCentro();
    const ids = await enContexto(base, ctx, async (tx) => {
      const creados = [];
      for (const nombre of ["Ana", "Bea"]) {
        const alta = await crearAlumno(tx, { ...ANA, nombre });
        if (!alta.ok) throw new Error(alta.error.mensaje);
        creados.push(alta.valor.id);
      }
      return creados;
    });
    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: ids[1] ?? "", activo: false }));

    const alumnos = await enContexto(base, ctx, (tx) => obtenerAlumnos(tx, ids));

    expect(alumnos.map((a) => [a.nombre, a.activo]).sort()).toEqual([
      ["Ana", true],
      ["Bea", false],
    ]);
  });

  it("ignora los ids que no existen o son de otro centro", async () => {
    const propio = await nuevoCentro();
    const ajeno = await nuevoCentro();
    const alta = await enContexto(base, ajeno, (tx) => crearAlumno(tx, ANA));
    if (!alta.ok) throw new Error(alta.error.mensaje);

    const alumnos = await enContexto(base, propio, (tx) =>
      obtenerAlumnos(tx, [alta.valor.id, randomUUID()]),
    );
    expect(alumnos).toEqual([]);
  });

  it("sin ids no consulta, y no acepta más de una página larga", async () => {
    const ctx = await nuevoCentro();
    expect(await enContexto(base, ctx, (tx) => obtenerAlumnos(tx, []))).toEqual([]);
    const demasiados = Array.from({ length: 101 }, () => randomUUID());
    await expect(enContexto(base, ctx, (tx) => obtenerAlumnos(tx, demasiados))).rejects.toThrow(
      /100/,
    );
  });
});
