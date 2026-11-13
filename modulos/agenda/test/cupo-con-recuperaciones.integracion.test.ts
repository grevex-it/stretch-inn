// El cupo de cada fecha cuenta también las recuperaciones (las da asistencia por un puerto, que
// conecta la API): inscribir a un fijo o bajar el cupo no puede dejar una fecha futura con más
// gente que lugares. Sobre Postgres real, con RLS; el puerto es falso.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda } from "../src/index.ts";
import { centroConDosSedes, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
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

/**
 * Una clase de Norte con ese cupo y Ana inscripta, sus fechas de las dos semanas que vienen (la
 * segunda, cancelada) y una agenda cuyo puerto dice `deMas` en la primera.
 */
async function escenario(cupo: number, deMas: number) {
  const centro = await centroConDosSedes(base, {
    norte: [...TODO, "personas.ver", "personas.editar"],
    sur: [],
  });
  const pedidas: string[][] = [];
  let primera = "";
  const agenda = crearAgenda(base, {
    ocupadasDeMas: (_tx, { ocurrenciaIds }) => {
      pedidas.push([...ocurrenciaIds]);
      return Promise.resolve(new Map(deMas > 0 ? [[primera, deMas]] : []));
    },
  });
  const creada = await agenda.crearClase(centro.ctx, { ...STRETCHING, sedeId: centro.norte, cupo });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  const claseId = creada.valor.id;
  const fechas = [];
  for (const semanas of [1, 2]) {
    const semana = await agenda.semana(centro.ctx, {
      ...PRIMERA,
      sedeId: centro.norte,
      desde: lunesDe(new Date(Date.now() + semanas * SEMANA)),
    });
    const fecha = semana.ok ? semana.valor.elementos[0] : undefined;
    if (fecha === undefined) throw new Error("Falta una fecha.");
    fechas.push(fecha);
  }
  const [unaSemana, dosSemanas] = fechas as [(typeof fechas)[0], (typeof fechas)[0]];
  primera = unaSemana.id;
  await agenda.fijarCancelada(centro.ctx, { id: dosSemanas.id, cancelada: true });
  const ana = await alumno(centro.ctx, "Ana");
  const alta = await agenda.inscribir(centro.ctx, { claseId, alumnoId: ana });
  if (!alta.ok) throw new Error(alta.error.mensaje);
  pedidas.length = 0;
  const clase = async () => {
    const lista = await agenda.clases(centro.ctx, { ...PRIMERA, sedeId: centro.norte });
    const suya = lista.ok ? lista.valor.elementos.find((c) => c.id === claseId) : undefined;
    if (suya === undefined) throw new Error("No está la clase.");
    return suya;
  };
  return { ...centro, agenda, claseId, unaSemana, dosSemanas, pedidas, clase };
}

describe("inscribir con recuperaciones en fechas futuras", () => {
  it("si una fecha futura ya está llena con recuperaciones, no inscribe y dice cuál", async () => {
    // Cupo 2: Ana fija y una recuperación de más en la fecha de la semana que viene.
    const { ctx, agenda, claseId, unaSemana } = await escenario(2, 1);
    const bea = await alumno(ctx, "Bea");

    const alta = await agenda.inscribir(ctx, { claseId, alumnoId: bea });

    expect(alta.ok).toBe(false);
    expect(!alta.ok && alta.error.codigo).toBe("fecha-completa");
    const [anio, mes, dia] = unaSemana.fecha.split("-");
    expect(!alta.ok && alta.error.mensaje).toContain(`${dia ?? ""}/${mes ?? ""}/${anio ?? ""}`);
  });

  it("con lugar en todas las fechas inscribe; pregunta solo por las futuras no canceladas", async () => {
    const { ctx, agenda, claseId, unaSemana, pedidas } = await escenario(3, 1);
    const bea = await alumno(ctx, "Bea");

    const alta = await agenda.inscribir(ctx, { claseId, alumnoId: bea });

    expect(alta.ok).toBe(true);
    expect(pedidas.flat()).toEqual([unaSemana.id]);
  });
});

describe("bajar el cupo con recuperaciones en fechas futuras", () => {
  it("no deja menos lugares que los fijos más las recuperaciones de más", async () => {
    const { ctx, agenda, clase } = await escenario(3, 1);
    const { id, version, nombre, dia, hora, duracionMinutos } = await clase();
    const editar = (cupo: number, v: number) =>
      agenda.editarClase(ctx, { id, version: v, nombre, dia, hora, duracionMinutos, cupo });

    const aUno = await editar(1, version);
    expect(!aUno.ok && aUno.error.codigo).toBe("fecha-completa");
    const aDos = await editar(2, version);
    expect(aDos.ok).toBe(true);
  });
});
