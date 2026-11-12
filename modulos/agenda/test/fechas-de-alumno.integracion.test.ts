// Las fechas del horario fijo de un alumno en una sede, para abonos (0020): cada fecha gasta una
// clase del abono. Sobre Postgres real: varias clases por semana, fechas canceladas, otra sede,
// bajas y fechas que todavía no estaban armadas.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, fechasDeAlumno, type Agenda } from "../src/index.ts";
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
const DIA = 86_400_000;
const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
/** El lunes de la semana que viene: las inscripciones de los tests ya están vigentes. */
const LUNES = lunesDe(new Date(Date.now() + 7 * DIA));

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

/** Ana va los lunes y los jueves a Norte, y los miércoles a Sur. */
async function anaDosVecesPorSemana() {
  const centro = await centroConDosSedes(base, {
    norte: [...TODO, ...ALUMNOS],
    sur: [...TODO, ...ALUMNOS],
  });
  const { ctx, norte, sur } = centro;
  const clase = async (sedeId: string, dia: number) => {
    const creada = await agenda.crearClase(ctx, { ...STRETCHING, sedeId, dia });
    if (!creada.ok) throw new Error(creada.error.mensaje);
    return creada.valor.id;
  };
  const [lunes, jueves, miercoles] = [
    await clase(norte, 1),
    await clase(norte, 4),
    await clase(sur, 3),
  ];
  const ana = await alumno(ctx, "Ana");
  const inscripciones: Record<string, string> = {};
  for (const claseId of [lunes, jueves, miercoles]) {
    const alta = await agenda.inscribir(ctx, { claseId, alumnoId: ana });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    inscripciones[claseId] = alta.valor.id;
  }
  return { ...centro, ana, lunes, jueves, inscripciones };
}

const dias = (fechas: { fecha: string }[]) => fechas.map((f) => f.fecha);

describe("fechasDeAlumno", () => {
  it("las próximas N fechas de su horario fijo en la sede, en orden, armando las que falten", async () => {
    const { ctx, norte, ana, lunes } = await anaDosVecesPorSemana();
    const fechas = await enContexto(base, ctx, (tx) =>
      fechasDeAlumno(tx, { alumnoId: ana, sedeId: norte, desde: LUNES, cantidad: 4 }),
    );
    expect(dias(fechas)).toEqual([
      LUNES,
      sumarDias(LUNES, 3),
      sumarDias(LUNES, 7),
      sumarDias(LUNES, 10),
    ]);
    expect(fechas[0]).toMatchObject({ claseId: lunes });
    expect(fechas[0]?.empiezaEn).toBeInstanceOf(Date);
  });

  it("una fecha cancelada no cuenta", async () => {
    const { ctx, norte, ana } = await anaDosVecesPorSemana();
    const semana = await agenda.semana(ctx, { ...PRIMERA, sedeId: norte, desde: LUNES });
    if (!semana.ok) throw new Error(semana.error.mensaje);
    const jueves = semana.valor.elementos.find((f) => f.fecha === sumarDias(LUNES, 3));
    await agenda.fijarCancelada(ctx, { id: jueves?.id ?? "", cancelada: true });

    const fechas = await enContexto(base, ctx, (tx) =>
      fechasDeAlumno(tx, { alumnoId: ana, sedeId: norte, desde: LUNES, cantidad: 4 }),
    );
    expect(dias(fechas)).toEqual([
      LUNES,
      sumarDias(LUNES, 7),
      sumarDias(LUNES, 10),
      sumarDias(LUNES, 14),
    ]);
  });

  it("después de la baja de una inscripción, esa clase ya no cuenta", async () => {
    const { ctx, norte, ana, jueves, inscripciones } = await anaDosVecesPorSemana();
    await agenda.darDeBajaInscripcion(ctx, { id: inscripciones[jueves] ?? "" });
    const fechas = await enContexto(base, ctx, (tx) =>
      fechasDeAlumno(tx, { alumnoId: ana, sedeId: norte, desde: LUNES, cantidad: 3 }),
    );
    expect(dias(fechas)).toEqual([LUNES, sumarDias(LUNES, 7), sumarDias(LUNES, 14)]);
  });

  it("sin inscripciones en la sede no hay fechas, y pide entre 1 y 100", async () => {
    const { ctx, norte, sur, ana } = await anaDosVecesPorSemana();
    const bea = await alumno(ctx, "Bea");
    await expect(
      enContexto(base, ctx, (tx) =>
        fechasDeAlumno(tx, { alumnoId: bea, sedeId: norte, desde: LUNES, cantidad: 4 }),
      ),
    ).resolves.toEqual([]);
    const enSur = await enContexto(base, ctx, (tx) =>
      fechasDeAlumno(tx, { alumnoId: ana, sedeId: sur, desde: LUNES, cantidad: 2 }),
    );
    expect(dias(enSur)).toEqual([sumarDias(LUNES, 2), sumarDias(LUNES, 9)]);
    await expect(
      enContexto(base, ctx, (tx) =>
        fechasDeAlumno(tx, { alumnoId: ana, sedeId: norte, desde: LUNES, cantidad: 101 }),
      ),
    ).rejects.toThrow("entre 1 y 100");
  });
});
