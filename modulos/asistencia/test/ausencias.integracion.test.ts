// El alumno de viaje (0022): avisa una sola vez que no viene en un período, y su lugar queda libre
// para recuperar en cada fecha de su horario fijo. Sobre Postgres real, con RLS.
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
const DIA = 24 * HORA;
const diaMas = (dia: string, dias: number) =>
  new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * DIA).toISOString().slice(0, 10);

/** El reloj tres horas antes de la fecha del lunes que viene. */
async function escenario() {
  const datos = await claseConFecha(base);
  const asistencia = crearAsistencia(base, {
    ahora: () => new Date(datos.fecha.empiezaEn.getTime() - 3 * HORA),
  });
  return { ...datos, asistencia };
}

describe("avisarPeriodo", () => {
  it("avisa cada fecha de su horario fijo en el período y libera su lugar", async () => {
    const { ctx, norte, ana, fecha, asistencia } = await escenario();

    const viaje = await asistencia.avisarPeriodo(ctx, {
      alumnoId: ana,
      sedeId: norte,
      desde: fecha.fecha,
      hasta: diaMas(fecha.fecha, 15),
    });

    // Los lunes del período: el de la fecha y los dos siguientes.
    expect(viaje).toEqual({ ok: true, valor: { avisos: 3 } });
    const planilla = await asistencia.planilla(ctx, { ...PRIMERA, fechaId: fecha.id });
    if (!planilla.ok) throw new Error(planilla.error.mensaje);
    const suya = planilla.valor.alumnos.elementos.find((r) => r.alumnoId === ana);
    expect(suya?.avisoId).not.toBeNull();
  });

  it("repetirlo no avisa dos veces; las fechas ya avisadas no cuentan", async () => {
    const { ctx, norte, ana, fecha, asistencia } = await escenario();
    await asistencia.avisar(ctx, { fechaId: fecha.id, alumnoId: ana });
    const periodo = {
      alumnoId: ana,
      sedeId: norte,
      desde: fecha.fecha,
      hasta: diaMas(fecha.fecha, 8),
    };

    const primero = await asistencia.avisarPeriodo(ctx, periodo);
    const otraVez = await asistencia.avisarPeriodo(ctx, periodo);

    expect(primero.ok && primero.valor.avisos).toBe(1);
    expect(otraVez.ok && otraVez.valor.avisos).toBe(0);
  });

  it("sin fechas del horario fijo en el período, o con el período al revés, falla", async () => {
    const { ctx, norte, sur, ana, fecha, asistencia } = await escenario();

    const enSur = await asistencia.avisarPeriodo(ctx, {
      alumnoId: ana,
      sedeId: sur,
      desde: fecha.fecha,
      hasta: diaMas(fecha.fecha, 15),
    });
    expect(!enSur.ok && enSur.error.codigo).toBe("sin-permiso");
    const sinFechas = await asistencia.avisarPeriodo(ctx, {
      alumnoId: ana,
      sedeId: norte,
      desde: diaMas(fecha.fecha, 1),
      hasta: diaMas(fecha.fecha, 3),
    });
    expect(!sinFechas.ok && sinFechas.error.codigo).toBe("sin-fechas");
    const alReves = await asistencia.avisarPeriodo(ctx, {
      alumnoId: ana,
      sedeId: norte,
      desde: diaMas(fecha.fecha, 3),
      hasta: fecha.fecha,
    });
    expect(!alReves.ok && alReves.error.codigo).toBe("periodo-invalido");
  });

  it("hace falta poder avisar en la sede", async () => {
    const { norte, ana, fecha, asistencia, otra } = await escenario();
    const soloVe = await otra(["asistencia.ver"]);

    const viaje = await asistencia.avisarPeriodo(soloVe, {
      alumnoId: ana,
      sedeId: norte,
      desde: fecha.fecha,
      hasta: diaMas(fecha.fecha, 15),
    });

    expect(!viaje.ok && viaje.error.codigo).toBe("sin-permiso");
  });
});
