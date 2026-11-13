// Lo que asistencia le da a agenda para no pasarse del cupo al inscribir a un fijo: cuántos
// lugares ocupan de más las recuperaciones en cada fecha (las recuperaciones menos los avisos).
// Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia, ocupadasDeMas } from "../src/index.ts";
import { claseConFecha } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const HORA = 60 * 60_000;

async function escenario() {
  const datos = await claseConFecha(base);
  const lunes = datos.fecha.empiezaEn.getTime();
  const asistencia = crearAsistencia(base, {
    ahora: () => new Date(lunes - 3 * HORA),
    abonoVigente: () =>
      Promise.resolve({ inicio: new Date(lunes - 7 * 24 * HORA), fin: new Date(lunes + HORA) }),
  });
  return { ...datos, asistencia };
}

describe("ocupadasDeMas", () => {
  it("cuenta por fecha las recuperaciones menos los avisos, solo donde sobran", async () => {
    const { ctx, ana, bea, fecha, asistencia, otraClase, nuevoAlumno } = await escenario();
    const yoga = await otraClase(2, 0);
    // Yoga: Ana recupera (una de más). Stretching: Bea avisa y Carla recupera en su lugar (cero).
    const enYoga = await asistencia.recuperar(ctx, { fechaId: yoga.fecha.id, alumnoId: ana });
    const aviso = await asistencia.avisar(ctx, { fechaId: fecha.id, alumnoId: bea });
    const carla = await nuevoAlumno("Carla");
    const enStretching = await asistencia.recuperar(ctx, { fechaId: fecha.id, alumnoId: carla });
    expect([enYoga.ok, aviso.ok, enStretching.ok]).toEqual([true, true, true]);

    const ocupadas = await enContexto(base, ctx, (tx) =>
      ocupadasDeMas(tx, { ocurrenciaIds: [yoga.fecha.id, fecha.id] }),
    );

    expect(ocupadas).toEqual(new Map([[yoga.fecha.id, 1]]));
  });

  it("sin fechas no consulta; con más de 100 falla", async () => {
    const { ctx } = await escenario();

    const vacio = await enContexto(base, ctx, (tx) => ocupadasDeMas(tx, { ocurrenciaIds: [] }));
    expect(vacio.size).toBe(0);
    const muchas = Array.from({ length: 101 }, () => crypto.randomUUID());
    await expect(
      enContexto(base, ctx, (tx) => ocupadasDeMas(tx, { ocurrenciaIds: muchas })),
    ).rejects.toThrow("hasta 100");
  });
});
