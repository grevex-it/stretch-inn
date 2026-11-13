// El profe asignado a cada alumno (0022, lo trae la planilla): un usuario activo del equipo del
// centro. Sobre Postgres real, con RLS.
import { type ContextoCentro } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, editarAlumno, obtenerAlumno } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);

async function comoDueno(consulta: string, valores: unknown[]): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    await cliente.query(consulta, valores);
  } finally {
    await cliente.end();
  }
}

/** Un usuario más del equipo del centro: un profe. */
async function profe(ctx: ContextoCentro, nombre: string, activo = true): Promise<string> {
  const [cuenta, usuario] = [randomUUID(), randomUUID()];
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, 'x', false)",
    [cuenta, `${cuenta}@prueba.com`],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre, activo) values ($1, $2, $3, $4, $5)",
    [usuario, ctx.centroId, cuenta, nombre, activo],
  );
  return usuario;
}

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
