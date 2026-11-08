// La planilla de asistencia de una fecha, sobre Postgres real: quiénes figuran, tomar y corregir
// sin efecto doble, las reglas de la fecha y los permisos por sede.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia } from "../src/index.ts";
import { claseConFecha, comoDueno, ARMAR } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };

/** La asistencia con el reloj en el inicio de la fecha. */
const enLaClase = (empiezaEn: string) =>
  crearAsistencia(base, { ahora: () => new Date(empiezaEn) });

describe("planilla", () => {
  it("trae la fecha y sus inscriptos por orden de inscripción, todavía sin marcar", async () => {
    const { ctx, ana, bea, fecha } = await claseConFecha(base);
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());

    const planilla = await asistencia.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });

    expect(planilla).toMatchObject({
      ok: true,
      valor: {
        fecha: { id: fecha.id, nombre: "Stretching", cancelada: false },
        alumnos: {
          ...PRIMERA,
          total: 2,
          elementos: [
            { alumnoId: ana, nombre: "Ana", apellido: "Prueba", activo: true, estado: null },
            { alumnoId: bea, nombre: "Bea", estado: null },
          ],
        },
      },
    });
  });

  it("tomar guarda las marcas; tomar de nuevo corrige, sin duplicar", async () => {
    const { ctx, ana, bea, fecha } = await claseConFecha(base);
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());
    const pedido = { fechaId: fecha.id };

    expect(
      await asistencia.tomar(ctx, {
        ...pedido,
        marcas: [
          { alumnoId: ana, estado: "presente" },
          { alumnoId: bea, estado: "ausente" },
        ],
      }),
    ).toEqual({ ok: true, valor: null });
    await asistencia.tomar(ctx, { ...pedido, marcas: [{ alumnoId: bea, estado: "presente" }] });
    await asistencia.tomar(ctx, { ...pedido, marcas: [{ alumnoId: bea, estado: "presente" }] });

    const planilla = await asistencia.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });
    expect(planilla.ok && planilla.valor.alumnos.elementos.map((r) => r.estado)).toEqual([
      "presente",
      "presente",
    ]);
    const filas = await contar(fecha.id);
    expect(filas).toBe(2);
  });

  it("solo se marca a quien estaba inscripto: si uno no, no se guarda ninguna", async () => {
    const { ctx, ana, fecha, nuevoAlumno } = await claseConFecha(base);
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());
    const ajeno = await nuevoAlumno("Caro");

    const resultado = await asistencia.tomar(ctx, {
      fechaId: fecha.id,
      marcas: [
        { alumnoId: ana, estado: "presente" },
        { alumnoId: ajeno, estado: "presente" },
      ],
    });

    expect(resultado).toMatchObject({ ok: false, error: { codigo: "no-inscripto" } });
    expect(await contar(fecha.id)).toBe(0);
  });

  it("no se toma antes de una hora del inicio ni en una fecha cancelada", async () => {
    const { ctx, agenda, ana, fecha } = await claseConFecha(base);
    const marcas = [{ alumnoId: ana, estado: "presente" as const }];
    const temprano = crearAsistencia(base, {
      ahora: () => new Date(fecha.empiezaEn.getTime() - 2 * 60 * 60_000),
    });
    expect(await temprano.tomar(ctx, { fechaId: fecha.id, marcas })).toMatchObject({
      ok: false,
      error: { codigo: "todavia-no-empieza" },
    });

    await agenda.fijarCancelada(ctx, { id: fecha.id, cancelada: true });
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());
    expect(await asistencia.tomar(ctx, { fechaId: fecha.id, marcas })).toMatchObject({
      ok: false,
      error: { codigo: "fecha-cancelada" },
    });
  });
});

describe("permisos", () => {
  it("ver la planilla pide asistencia.ver y tomarla, asistencia.tomar, en la sede de la fecha", async () => {
    const { ana, fecha, otra } = await claseConFecha(base);
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());
    const marcas = [{ alumnoId: ana, estado: "presente" as const }];

    const soloVe = await otra(["asistencia.ver"]);
    expect((await asistencia.planilla(soloVe, { ...PRIMERA, fechaId: fecha.id })).ok).toBe(true);
    expect(await asistencia.tomar(soloVe, { fechaId: fecha.id, marcas })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });

    const sinAsistencia = await otra(ARMAR);
    expect(
      await asistencia.planilla(sinAsistencia, { ...PRIMERA, fechaId: fecha.id }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });

  it("la fecha de otro centro no existe", async () => {
    const { fecha } = await claseConFecha(base);
    const otroCentro = await claseConFecha(base);
    const asistencia = enLaClase(fecha.empiezaEn.toISOString());
    expect(
      await asistencia.planilla(otroCentro.ctx, { ...PRIMERA, fechaId: fecha.id }),
    ).toMatchObject({ ok: false, error: { codigo: "fecha-inexistente" } });
  });
});

/** Cuántas marcas tiene la fecha, contadas como dueño (sin RLS). */
async function contar(ocurrenciaId: string): Promise<number> {
  const [fila] = await comoDueno<{ total: string }>(
    "select count(*) as total from asistencias where ocurrencia_id = $1",
    [ocurrenciaId],
  );
  return Number(fila?.total);
}
