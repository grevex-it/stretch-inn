// Avisos de ausencia sobre Postgres real: avisar y anular sin efecto doble, las reglas de la
// fecha, el aviso en la planilla y los permisos por sede.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia } from "../src/index.ts";
import { claseConFecha } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PRIMERA = { pagina: 1, porPagina: 50 };
const HORA = 60 * 60_000;

/** La asistencia con el reloj corrido respecto del inicio de la fecha. */
const aLas = (empiezaEn: Date, corrimiento: number) =>
  crearAsistencia(base, { ahora: () => new Date(empiezaEn.getTime() + corrimiento) });

describe("avisar y anular", () => {
  it("el aviso figura en la planilla; avisar dos veces no duplica; anularlo lo saca", async () => {
    const { ctx, ana, fecha } = await claseConFecha(base);
    const antes = aLas(fecha.empiezaEn, -2 * HORA);
    const pedido = { fechaId: fecha.id, alumnoId: ana };

    const aviso = await antes.avisar(ctx, pedido);
    if (!aviso.ok) throw new Error(aviso.error.mensaje);
    expect(await antes.avisar(ctx, pedido)).toMatchObject({
      ok: false,
      error: { codigo: "ya-avisado" },
    });
    const conAviso = await antes.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });
    expect(conAviso.ok && conAviso.valor.alumnos.elementos.map((r) => r.avisoId)).toEqual([
      aviso.valor.id,
      null,
    ]);

    expect(await antes.anularAviso(ctx, aviso.valor)).toEqual({ ok: true, valor: null });
    expect(await antes.anularAviso(ctx, aviso.valor)).toMatchObject({
      ok: false,
      error: { codigo: "aviso-inexistente" },
    });
    const sinAviso = await antes.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });
    expect(sinAviso.ok && sinAviso.valor.alumnos.elementos[0]?.avisoId).toBe(null);
    expect((await antes.avisar(ctx, pedido)).ok).toBe(true);
  });

  it("con aviso igual se le toma asistencia: si vino, queda presente", async () => {
    const { ctx, ana, fecha } = await claseConFecha(base);
    const aviso = await aLas(fecha.empiezaEn, -HORA).avisar(ctx, {
      fechaId: fecha.id,
      alumnoId: ana,
    });
    if (!aviso.ok) throw new Error(aviso.error.mensaje);
    const enLaClase = aLas(fecha.empiezaEn, 0);
    await enLaClase.tomar(ctx, {
      fechaId: fecha.id,
      marcas: [{ alumnoId: ana, estado: "presente" }],
    });
    const planilla = await enLaClase.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });
    expect(planilla.ok && planilla.valor.alumnos.elementos[0]).toMatchObject({
      estado: "presente",
      avisoId: aviso.valor.id,
    });
  });
});

describe("reglas de la fecha", () => {
  it("solo avisa quien estaba inscripto, y antes del inicio", async () => {
    const { ctx, ana, fecha, nuevoAlumno } = await claseConFecha(base);
    const ajeno = await nuevoAlumno("Caro");
    expect(
      await aLas(fecha.empiezaEn, -HORA).avisar(ctx, { fechaId: fecha.id, alumnoId: ajeno }),
    ).toMatchObject({ ok: false, error: { codigo: "no-inscripto" } });

    const aviso = await aLas(fecha.empiezaEn, -HORA).avisar(ctx, {
      fechaId: fecha.id,
      alumnoId: ana,
    });
    if (!aviso.ok) throw new Error(aviso.error.mensaje);
    const empezada = aLas(fecha.empiezaEn, 0);
    expect(await empezada.anularAviso(ctx, aviso.valor)).toMatchObject({
      ok: false,
      error: { codigo: "clase-empezada" },
    });
    expect(await empezada.avisar(ctx, { fechaId: fecha.id, alumnoId: ana })).toMatchObject({
      ok: false,
      error: { codigo: "clase-empezada" },
    });
  });

  it("en una fecha cancelada no se avisa", async () => {
    const { ctx, agenda, ana, fecha } = await claseConFecha(base);
    await agenda.fijarCancelada(ctx, { id: fecha.id, cancelada: true });
    expect(
      await aLas(fecha.empiezaEn, -HORA).avisar(ctx, { fechaId: fecha.id, alumnoId: ana }),
    ).toMatchObject({ ok: false, error: { codigo: "fecha-cancelada" } });
  });
});

describe("permisos", () => {
  it("avisar y anular piden asistencia.avisar en la sede; de otro centro, no existe", async () => {
    const { ctx, ana, fecha, otra } = await claseConFecha(base);
    const antes = aLas(fecha.empiezaEn, -HORA);
    const soloVe = await otra(["asistencia.ver"]);
    expect(await antes.avisar(soloVe, { fechaId: fecha.id, alumnoId: ana })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });

    const aviso = await antes.avisar(ctx, { fechaId: fecha.id, alumnoId: ana });
    if (!aviso.ok) throw new Error(aviso.error.mensaje);
    expect(await antes.anularAviso(soloVe, aviso.valor)).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    const otroCentro = await claseConFecha(base);
    expect(await antes.anularAviso(otroCentro.ctx, aviso.valor)).toMatchObject({
      ok: false,
      error: { codigo: "aviso-inexistente" },
    });
  });
});
