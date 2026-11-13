// La baja de un alumno libera sus lugares fijos (0019): las inscripciones vigentes pasan a baja y
// los contadores de cada clase bajan. Sobre Postgres real, con RLS.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, inscriptosEnFecha, liberarLugares, type Agenda } from "../src/index.ts";
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

async function alumno(ctx: ContextoCentro, nombre: string) {
  const alta = await enContexto(base, ctx, (tx) =>
    crearAlumno(tx, {
      nombre,
      apellido: "Prueba",
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

async function clase(ctx: ContextoCentro, sedeId: string, dia: number) {
  const creada = await agenda.crearClase(ctx, { ...STRETCHING, sedeId, dia });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  return creada.valor.id;
}

async function inscribir(ctx: ContextoCentro, claseId: string, alumnoId: string) {
  const alta = await agenda.inscribir(ctx, { claseId, alumnoId });
  if (!alta.ok) throw new Error(alta.error.mensaje);
}

async function inscriptosDe(ctx: ContextoCentro, sedeId: string) {
  const lista = await agenda.clases(ctx, { ...PRIMERA, sedeId });
  if (!lista.ok) throw new Error(lista.error.mensaje);
  return new Map(lista.valor.elementos.map((c) => [c.id, c.inscriptos]));
}

/** Ana en dos clases de Norte y Bea en una. */
async function escenario() {
  const centro = await centroConDosSedes(base, {
    norte: [...TODO, ...ALUMNOS],
    sur: [...TODO, ...ALUMNOS],
  });
  const [lunes, miercoles] = [
    await clase(centro.ctx, centro.norte, 1),
    await clase(centro.ctx, centro.norte, 3),
  ];
  const [ana, bea] = [await alumno(centro.ctx, "Ana"), await alumno(centro.ctx, "Bea")];
  await inscribir(centro.ctx, lunes, ana);
  await inscribir(centro.ctx, miercoles, ana);
  await inscribir(centro.ctx, lunes, bea);
  return { ...centro, lunes, miercoles, ana, bea };
}

describe("liberarLugares", () => {
  it("da de baja las inscripciones vigentes del alumno y libera cada lugar", async () => {
    const { ctx, norte, lunes, miercoles, ana } = await escenario();

    const liberadas = await enContexto(base, ctx, (tx) =>
      liberarLugares(tx, { alumnoId: ana, ahora: new Date() }),
    );

    expect(liberadas).toBe(2);
    const inscriptos = await inscriptosDe(ctx, norte);
    expect(inscriptos.get(lunes)).toBe(1);
    expect(inscriptos.get(miercoles)).toBe(0);
    const deAna = await agenda.clasesDeAlumno(ctx, { ...PRIMERA, alumnoId: ana });
    expect(deAna.ok && deAna.valor.total).toBe(0);
  });

  it("no toca a los demás alumnos y conserva la historia anterior a la baja", async () => {
    const { ctx, lunes, ana, bea } = await escenario();
    // La baja, un segundo después de `antes`: con dos new Date() seguidos pueden caer en el mismo
    // milisegundo, y una baja en ese mismo momento ya no la deja vigente.
    const antes = new Date();
    const baja = new Date(antes.getTime() + 1000);

    await enContexto(base, ctx, (tx) => liberarLugares(tx, { alumnoId: ana, ahora: baja }));

    const enAquelMomento = await enContexto(base, ctx, (tx) =>
      inscriptosEnFecha(tx, { claseId: lunes, momento: antes, ...PRIMERA }),
    );
    expect(enAquelMomento.elementos.map((i) => i.alumnoId)).toEqual([ana, bea]);
    const ahora = await enContexto(base, ctx, (tx) =>
      inscriptosEnFecha(tx, { claseId: lunes, momento: baja, ...PRIMERA }),
    );
    expect(ahora.elementos.map((i) => i.alumnoId)).toEqual([bea]);
  });

  it("se puede repetir sin efecto doble", async () => {
    const { ctx, norte, lunes, ana } = await escenario();
    const liberar = () =>
      enContexto(base, ctx, (tx) => liberarLugares(tx, { alumnoId: ana, ahora: new Date() }));

    await liberar();
    expect(await liberar()).toBe(0);
    expect((await inscriptosDe(ctx, norte)).get(lunes)).toBe(1);
  });

  it("libera también los lugares en otra sede del centro", async () => {
    const { ctx, sur, ana } = await escenario();
    const enSur = await clase(ctx, sur, 5);
    await inscribir(ctx, enSur, ana);

    const liberadas = await enContexto(base, ctx, (tx) =>
      liberarLugares(tx, { alumnoId: ana, ahora: new Date() }),
    );

    expect(liberadas).toBe(3);
    expect((await inscriptosDe(ctx, sur)).get(enSur)).toBe(0);
  });
});
