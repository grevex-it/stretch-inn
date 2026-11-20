// El contacto de emergencia del alumno: requisito del cliente (0019). Opcional, para no frenar la
// importación de la planilla, que no lo trae. Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
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

describe("contacto de emergencia", () => {
  it("se carga recortado; editar sin mandarlo lo conserva y vacío lo borra", async () => {
    const ctx = await nuevoCentro();
    const contacto = { emergenciaNombre: " Marta (madre) ", emergenciaTelefono: " 11 4444-5555 " };
    const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, ...contacto }));
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const id = alta.valor.id;
    const leer = async () => {
      const alumno = await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));
      return [alumno?.emergenciaNombre, alumno?.emergenciaTelefono];
    };

    expect(await leer()).toEqual(["Marta (madre)", "11 4444-5555"]);
    await enContexto(base, ctx, (tx) => editarAlumno(tx, { ...ANA, id, version: 1 }));
    expect(await leer()).toEqual(["Marta (madre)", "11 4444-5555"]);
    await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, id, version: 2, emergenciaNombre: "", emergenciaTelefono: null }),
    );
    expect(await leer()).toEqual([null, null]);
  });

  it("sin contacto de emergencia el alta pasa igual", async () => {
    const ctx = await nuevoCentro();
    const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, ANA));
    expect(alta.ok).toBe(true);
  });

  it("si se carga el teléfono de emergencia, tiene al menos 6 números", async () => {
    const ctx = await nuevoCentro();
    const alta = await enContexto(base, ctx, (tx) =>
      crearAlumno(tx, { ...ANA, emergenciaTelefono: "123" }),
    );
    expect(alta).toMatchObject({
      ok: false,
      error: {
        codigo: "telefono-invalido",
        mensaje: "Revisá el teléfono de emergencia: tiene que tener al menos 6 números.",
      },
    });
  });
});
