// Lo que agenda les da a otros módulos (asistencia): una fecha con su clase y quiénes estaban
// inscriptos en un momento dado. Sobre Postgres real, con RLS.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  crearAgenda,
  estabanInscriptos,
  inscriptosEnFecha,
  obtenerFecha,
  type Agenda,
} from "../src/index.ts";
import { centroConDosSedes, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

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
const SEMANA = 7 * 86_400_000;

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

/** Una clase de Norte con dos inscriptos y su fecha de la semana que viene. */
async function claseConFecha() {
  const centro = await centroConDosSedes(base, { norte: [...TODO, ...ALUMNOS], sur: [] });
  const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, sedeId: centro.norte });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  const claseId = creada.valor.id;
  const [ana, bea] = [await alumno(centro.ctx, "Ana"), await alumno(centro.ctx, "Bea")];
  const inscripciones: string[] = [];
  for (const alumnoId of [ana, bea]) {
    const alta = await agenda.inscribir(centro.ctx, { claseId, alumnoId });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    inscripciones.push(alta.valor.id);
  }
  const semana = await agenda.semana(centro.ctx, {
    ...PRIMERA,
    sedeId: centro.norte,
    desde: lunesDe(new Date(Date.now() + SEMANA)),
  });
  if (!semana.ok) throw new Error(semana.error.mensaje);
  const fecha = semana.valor.elementos[0];
  if (fecha === undefined) throw new Error("La clase no tiene fecha la semana que viene.");
  return { ...centro, claseId, ana, bea, inscripciones, fecha };
}

describe("obtenerFecha", () => {
  it("trae la fecha con su clase y su sede; de otro centro, no existe", async () => {
    const { ctx, norte, claseId, fecha } = await claseConFecha();

    const leida = await enContexto(base, ctx, (tx) => obtenerFecha(tx, fecha.id));
    expect(leida).toEqual({
      id: fecha.id,
      claseId,
      sedeId: norte,
      nombre: "Stretching",
      fecha: fecha.fecha,
      empiezaEn: fecha.empiezaEn,
      terminaEn: fecha.terminaEn,
      cancelada: false,
    });

    const otro = await centroConDosSedes(base, { norte: TODO, sur: [] });
    await expect(enContexto(base, otro.ctx, (tx) => obtenerFecha(tx, fecha.id))).resolves.toBe(
      undefined,
    );
  });
});

describe("inscriptos en un momento", () => {
  it("trae a los que tenían la inscripción vigente en ese momento, por orden de inscripción", async () => {
    const { ctx, claseId, ana, bea, fecha } = await claseConFecha();

    const enLaFecha = await enContexto(base, ctx, (tx) =>
      inscriptosEnFecha(tx, { ...PRIMERA, claseId, momento: fecha.empiezaEn }),
    );
    expect(enLaFecha).toEqual({
      ...PRIMERA,
      total: 2,
      elementos: [{ alumnoId: ana }, { alumnoId: bea }],
    });

    const antesDeInscribirse = await enContexto(base, ctx, (tx) =>
      inscriptosEnFecha(tx, { ...PRIMERA, claseId, momento: new Date(Date.now() - SEMANA) }),
    );
    expect(antesDeInscribirse.total).toBe(0);
  });

  it("una baja saca al alumno de las fechas posteriores, no de las anteriores", async () => {
    const { ctx, claseId, ana, bea, inscripciones, fecha } = await claseConFecha();
    const antesDeLaBaja = new Date();
    await agenda.darDeBajaInscripcion(ctx, { id: inscripciones[0] ?? "" });

    const despues = await enContexto(base, ctx, (tx) =>
      estabanInscriptos(tx, { claseId, momento: fecha.empiezaEn, alumnoIds: [ana, bea] }),
    );
    expect([...despues]).toEqual([bea]);

    const antes = await enContexto(base, ctx, (tx) =>
      estabanInscriptos(tx, { claseId, momento: antesDeLaBaja, alumnoIds: [ana, bea] }),
    );
    expect(new Set(antes)).toEqual(new Set([ana, bea]));
  });

  it("estabanInscriptos acepta hasta 100 alumnos por consulta", async () => {
    const { ctx, claseId, fecha } = await claseConFecha();
    const muchos = Array.from({ length: 101 }, () => crypto.randomUUID());
    await expect(
      enContexto(base, ctx, (tx) =>
        estabanInscriptos(tx, { claseId, momento: fecha.empiezaEn, alumnoIds: muchos }),
      ),
    ).rejects.toThrow("hasta 100");
  });
});
