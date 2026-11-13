// Las camas de cada sede (12/11, docs/pendientes.md): variables desde el panel, son el tope del
// cupo de todas sus clases. Al bajarlas, las clases con más cupo bajan con ellas, salvo que eso
// deje afuera a un fijo o a una recuperación. Sobre Postgres real, con RLS.
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, type Agenda } from "../src/index.ts";
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

const centro = () => centroConDosSedes(base, { norte: [...TODO, ...ALUMNOS], sur: ["agenda.ver"] });

async function clase(ctx: ContextoCentro, sedeId: string, cupo: number, inscriptos = 0) {
  const creada = await agenda.crearClase(ctx, { ...STRETCHING, sedeId, cupo });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  for (let i = 0; i < inscriptos; i++) {
    const alta = await agenda.inscribir(ctx, {
      claseId: creada.valor.id,
      alumnoId: await alumno(ctx, `Fijo ${String(i)}`),
    });
    if (!alta.ok) throw new Error(alta.error.mensaje);
  }
  return creada.valor.id;
}

async function cupos(ctx: ContextoCentro, sedeId: string) {
  const lista = await agenda.clases(ctx, { ...PRIMERA, sedeId });
  if (!lista.ok) throw new Error(lista.error.mensaje);
  return new Map(lista.valor.elementos.map((c) => [c.id, c.cupo]));
}

describe("camas de la sede", () => {
  it("sin configurar no hay tope; configuradas, se leen y ninguna clase las pasa", async () => {
    const { ctx, norte } = await centro();
    expect(await agenda.camas(ctx, { sedeId: norte })).toEqual({ ok: true, valor: null });
    await clase(ctx, norte, 30);

    expect((await agenda.fijarCamas(ctx, { sedeId: norte, camas: 40 })).ok).toBe(true);
    expect(await agenda.camas(ctx, { sedeId: norte })).toEqual({ ok: true, valor: 40 });

    const grande = await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte, cupo: 41 });
    expect(!grande.ok && grande.error.codigo).toBe("cupo-mayor-que-camas");
    const justa = await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte, cupo: 40 });
    expect(justa.ok).toBe(true);
  });

  it("editar una clase tampoco pasa las camas", async () => {
    const { ctx, norte } = await centro();
    const id = await clase(ctx, norte, 10);
    await agenda.fijarCamas(ctx, { sedeId: norte, camas: 10 });
    const lista = await agenda.clases(ctx, { ...PRIMERA, sedeId: norte });
    const version = lista.ok ? (lista.valor.elementos[0]?.version ?? 0) : 0;
    const { nombre, dia, hora, duracionMinutos } = STRETCHING;

    const editada = await agenda.editarClase(ctx, {
      id,
      version,
      nombre,
      dia,
      hora,
      duracionMinutos,
      cupo: 11,
    });

    expect(!editada.ok && editada.error.codigo).toBe("cupo-mayor-que-camas");
  });

  it("al bajarlas, baja el cupo de las clases que las pasan; subirlas no toca nada", async () => {
    const { ctx, norte } = await centro();
    const [chica, grande] = [await clase(ctx, norte, 4, 1), await clase(ctx, norte, 10, 2)];

    expect((await agenda.fijarCamas(ctx, { sedeId: norte, camas: 6 })).ok).toBe(true);
    expect(await cupos(ctx, norte)).toEqual(
      new Map([
        [chica, 4],
        [grande, 6],
      ]),
    );

    await agenda.fijarCamas(ctx, { sedeId: norte, camas: 20 });
    expect((await cupos(ctx, norte)).get(grande)).toBe(6);
  });

  it("no baja si deja afuera a un fijo, y dice en qué clase; no cambia nada", async () => {
    const { ctx, norte } = await centro();
    const llena = await clase(ctx, norte, 5, 4);
    await agenda.fijarCamas(ctx, { sedeId: norte, camas: 10 });

    const baja = await agenda.fijarCamas(ctx, { sedeId: norte, camas: 3 });

    expect(!baja.ok && baja.error.codigo).toBe("camas-menos-que-inscriptos");
    expect(!baja.ok && baja.error.mensaje).toContain("Stretching");
    expect(await agenda.camas(ctx, { sedeId: norte })).toEqual({ ok: true, valor: 10 });
    expect((await cupos(ctx, norte)).get(llena)).toBe(5);
  });

  it("no baja si una fecha futura queda con más recuperaciones que lugares", async () => {
    const { ctx, norte } = await centro();
    const conPuerto = crearAgenda(base, {
      ocupadasDeMas: (_tx, { ocurrenciaIds }) =>
        Promise.resolve(new Map(ocurrenciaIds.slice(0, 1).map((id) => [id, 2]))),
    });
    await clase(ctx, norte, 5, 2);
    await conPuerto.semana(ctx, {
      ...PRIMERA,
      sedeId: norte,
      desde: lunesDe(new Date(Date.now() + 7 * 86_400_000)),
    });

    const baja = await conPuerto.fijarCamas(ctx, { sedeId: norte, camas: 3 });

    expect(!baja.ok && baja.error.codigo).toBe("fecha-completa");
    expect((await conPuerto.fijarCamas(ctx, { sedeId: norte, camas: 4 })).ok).toBe(true);
  });

  it("valida la cantidad y el permiso en la sede", async () => {
    const { ctx, norte, sur } = await centro();

    const cero = await agenda.fijarCamas(ctx, { sedeId: norte, camas: 0 });
    expect(!cero.ok && cero.error.codigo).toBe("camas-invalidas");
    const ajena = await agenda.fijarCamas(ctx, { sedeId: sur, camas: 10 });
    expect(!ajena.ok && ajena.error.codigo).toBe("sin-permiso");
    expect((await agenda.camas(ctx, { sedeId: sur })).ok).toBe(true);
    expect((await agenda.fijarCamas(ctx, { sedeId: norte, camas: null })).ok).toBe(true);
  });
});
