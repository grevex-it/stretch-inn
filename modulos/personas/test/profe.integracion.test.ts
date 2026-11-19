// El profe asignado a cada alumno (0022, lo trae la planilla): un usuario activo del equipo del
// centro. Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, editarAlumno, obtenerAlumno } from "../src/index.ts";
import { ANA, contextoConPermisos, profe } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);

describe("profe asignado", () => {
  it("se carga con un usuario activo del centro; editar sin mandarlo lo conserva", async () => {
    const ctx = await nuevoCentro();
    const lore = await profe(ctx, "Lore");
    const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, profeId: lore }));
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const id = alta.valor.id;

    expect((await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id)))?.profeId).toBe(lore);
    await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, nombre: "Ana M.", id, version: 1 }),
    );
    expect((await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id)))?.profeId).toBe(lore);
    await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, id, version: 2, profeId: null }),
    );
    expect((await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id)))?.profeId).toBeNull();
  });

  it("no acepta un usuario de otro centro, inexistente ni inactivo", async () => {
    const [ctx, otro] = [await nuevoCentro(), await nuevoCentro()];
    const ajeno = await profe(otro, "Ajena");
    const inactiva = await profe(ctx, "Inactiva", false);

    for (const profeId of [ajeno, randomUUID(), inactiva]) {
      const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, profeId }));
      expect(!alta.ok && alta.error.codigo).toBe("profe-invalido");
    }
  });
});
