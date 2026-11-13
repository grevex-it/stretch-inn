// La baja de un alumno avisa en la misma transacción, para que agenda libere su horario fijo
// (0019). Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base, type Transaccion } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, fijarActivo, obtenerAlumno } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);

async function conAlumno() {
  const ctx = await nuevoCentro();
  const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, ANA));
  if (!alta.ok) throw new Error(alta.error.mensaje);
  return { ctx, id: alta.valor.id };
}

function anotador() {
  const llamadas: { tx: Transaccion; alumnoId: string; ahora: Date }[] = [];
  const alDarDeBaja = (tx: Transaccion, baja: { alumnoId: string; ahora: Date }) => {
    llamadas.push({ tx, ...baja });
    return Promise.resolve();
  };
  return { llamadas, alDarDeBaja };
}

describe("fijarActivo con alDarDeBaja", () => {
  it("al dar de baja avisa con el alumno y el momento, en la misma transacción", async () => {
    const { ctx, id } = await conAlumno();
    const { llamadas, alDarDeBaja } = anotador();
    const antes = Date.now();

    let transaccion: Transaccion | undefined;
    const resultado = await enContexto(base, ctx, (tx) => {
      transaccion = tx;
      return fijarActivo(tx, { id, activo: false }, alDarDeBaja);
    });

    expect(resultado.ok).toBe(true);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.alumnoId).toBe(id);
    expect(llamadas[0]?.tx).toBe(transaccion);
    expect(llamadas[0]?.ahora.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("no avisa al reactivar ni si el alumno no existe", async () => {
    const { ctx, id } = await conAlumno();
    const { llamadas, alDarDeBaja } = anotador();

    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: true }, alDarDeBaja));
    const otro = await enContexto(base, ctx, (tx) =>
      fijarActivo(tx, { id: randomUUID(), activo: false }, alDarDeBaja),
    );

    expect(otro.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });

  it("si el aviso falla, la baja no queda", async () => {
    const { ctx, id } = await conAlumno();
    const falla = () => Promise.reject(new Error("agenda no pudo liberar"));

    await expect(
      enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: false }, falla)),
    ).rejects.toThrow("agenda no pudo liberar");

    const alumno = await enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));
    expect(alumno?.activo).toBe(true);
  });
});
