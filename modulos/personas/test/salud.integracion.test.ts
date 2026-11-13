// Los datos de salud del alumno (patologías), aparte de su ficha y con permiso propio (0019): los
// ven los profes, la contadora no. Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAlumno, fijarSalud, obtenerSalud } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

async function conAlumno() {
  const ctx = await contextoConPermisos(base, ["personas.ver", "personas.editar"]);
  const alta = await enContexto(base, ctx, (tx) => crearAlumno(tx, ANA));
  if (!alta.ok) throw new Error(alta.error.mensaje);
  return { ctx, id: alta.valor.id };
}

describe("datos de salud", () => {
  it("sin cargar están vacíos; se guardan y se leen con su versión", async () => {
    const { ctx, id } = await conAlumno();
    const leer = () => enContexto(base, ctx, (tx) => obtenerSalud(tx, id));

    expect(await leer()).toEqual({ ok: true, valor: { patologias: "", version: 0 } });
    const guardada = await enContexto(base, ctx, (tx) =>
      fijarSalud(tx, { alumnoId: id, patologias: "  Hernia de disco L4-L5.  ", version: 0 }),
    );
    expect(guardada).toEqual({ ok: true, valor: { version: 1 } });
    expect(await leer()).toEqual({
      ok: true,
      valor: { patologias: "Hernia de disco L4-L5.", version: 1 },
    });
  });

  it("con una versión vieja no pisa lo que cargó otro", async () => {
    const { ctx, id } = await conAlumno();
    const fijar = (patologias: string, version: number) =>
      enContexto(base, ctx, (tx) => fijarSalud(tx, { alumnoId: id, patologias, version }));

    await fijar("Escoliosis.", 0);
    const vieja = await fijar("Otra cosa.", 0);

    expect(!vieja.ok && vieja.error.codigo).toBe("cambio-concurrente");
    const actual = await enContexto(base, ctx, (tx) => obtenerSalud(tx, id));
    expect(actual.ok && actual.valor.patologias).toBe("Escoliosis.");
  });

  it("un alumno inexistente o de otro centro no existe", async () => {
    const { id } = await conAlumno();
    const otro = await contextoConPermisos(base, ["personas.ver"]);

    for (const alumnoId of [id, randomUUID()]) {
      const leida = await enContexto(base, otro, (tx) => obtenerSalud(tx, alumnoId));
      expect(!leida.ok && leida.error.codigo).toBe("alumno-inexistente");
      const fijada = await enContexto(base, otro, (tx) =>
        fijarSalud(tx, { alumnoId, patologias: "x", version: 0 }),
      );
      expect(!fijada.ok && fijada.error.codigo).toBe("alumno-inexistente");
    }
  });

  it("tienen un largo máximo", async () => {
    const { ctx, id } = await conAlumno();

    const larga = await enContexto(base, ctx, (tx) =>
      fijarSalud(tx, { alumnoId: id, patologias: "x".repeat(4001), version: 0 }),
    );

    expect(!larga.ok && larga.error.codigo).toBe("salud-muy-larga");
  });
});
