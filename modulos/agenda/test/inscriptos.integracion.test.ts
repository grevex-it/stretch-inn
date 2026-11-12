// Los inscriptos de una clase con el nombre de cada alumno, sobre Postgres real. Los alumnos se
// leen de a una página por la API pública de personas (reglas 4 y 8).
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno, fijarActivo } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, type Agenda } from "../src/index.ts";
import { centroConDosSedes, STRETCHING, TODO } from "./ayudas.ts";

let base: Base;
let agenda: Agenda;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  agenda = crearAgenda(base);
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const ALUMNOS = ["personas.ver", "personas.editar"];

async function alumno(ctx: ContextoCentro, nombre: string, apellido: string) {
  const alta = await enContexto(base, ctx, (tx) =>
    crearAlumno(tx, {
      nombre,
      apellido,
      telefono: "11 5555-1234",
      documento: null,
      email: null,
      fechaNacimiento: null,
      notas: "",
    }),
  );
  if (!alta.ok) throw new Error(alta.error.mensaje);
  return alta.valor.id;
}

async function claseConInscriptos() {
  const centro = await centroConDosSedes(base, { norte: [...TODO, ...ALUMNOS], sur: [] });
  const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, sedeId: centro.norte });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  const claseId = creada.valor.id;
  const inscripciones: Record<string, string> = {};
  for (const [nombre, apellido] of [
    ["Bea", "Zapata"],
    ["Ana", "Pérez"],
  ] as const) {
    const alumnoId = await alumno(centro.ctx, nombre, apellido);
    const alta = await agenda.inscribir(centro.ctx, { claseId, alumnoId });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    inscripciones[nombre] = alta.valor.id;
  }
  return { ...centro, claseId, inscripciones };
}

describe("inscriptos de una clase", () => {
  it("trae los vigentes por orden de inscripción, con el nombre y el teléfono de cada alumno", async () => {
    const { ctx, claseId, inscripciones } = await claseConInscriptos();

    const lista = await agenda.inscriptos(ctx, { ...PRIMERA, claseId });

    expect(lista).toMatchObject({
      ok: true,
      valor: {
        ...PRIMERA,
        total: 2,
        elementos: [
          { id: inscripciones["Bea"], nombre: "Bea", apellido: "Zapata", activo: true },
          {
            id: inscripciones["Ana"],
            nombre: "Ana",
            apellido: "Pérez",
            telefono: "11 5555-1234",
            activo: true,
          },
        ],
      },
    });
  });

  it("no trae las bajas de la clase; un alumno dado de baja en personas aparece marcado", async () => {
    const { ctx, claseId, inscripciones } = await claseConInscriptos();
    await agenda.darDeBajaInscripcion(ctx, { id: inscripciones["Bea"] ?? "" });
    const quedan = await agenda.inscriptos(ctx, { ...PRIMERA, claseId });
    if (!quedan.ok) throw new Error(quedan.error.mensaje);
    const alumnoId = quedan.valor.elementos[0]?.alumnoId ?? "";
    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id: alumnoId, activo: false }));

    const lista = await agenda.inscriptos(ctx, { ...PRIMERA, claseId });
    expect(lista).toMatchObject({
      ok: true,
      valor: { total: 1, elementos: [{ nombre: "Ana", activo: false }] },
    });
  });

  it("sin agenda.ver en la sede de la clase, no la ve; de otro centro, no existe", async () => {
    const { claseId } = await claseConInscriptos();
    const otroCentro = await centroConDosSedes(base, { norte: [...TODO, ...ALUMNOS], sur: [] });
    expect(await agenda.inscriptos(otroCentro.ctx, { ...PRIMERA, claseId })).toMatchObject({
      ok: false,
      error: { codigo: "clase-inexistente" },
    });

    const soloGestion = await centroConDosSedes(base, { norte: ["agenda.gestionar"], sur: [] });
    const propia = await agenda.crearClase(soloGestion.ctx, {
      ...STRETCHING,
      sedeId: soloGestion.norte,
    });
    if (!propia.ok) throw new Error(propia.error.mensaje);
    expect(
      await agenda.inscriptos(soloGestion.ctx, { ...PRIMERA, claseId: propia.valor.id }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});
