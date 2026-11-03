import type {} from "@app/db/pruebas";
import { id, type ContextoCentro, type SedeId } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";
import { crearCentro, listarSedes, obtenerCentro, renombrarSede } from "../src/index.ts";

let base: Base;

beforeAll(() => {
  base = crearBase(inject("urlApp"));
});

afterAll(async () => {
  await base.cerrar();
});

/** Contexto de un centro con permisos en las sedes indicadas (el alta lo arma así). */
function contexto(centroId: string, sedes: string[]): ContextoCentro {
  return {
    centroId: id<"Centro">(centroId),
    actor: { tipo: "soporte", operadorId: id<"Operador">("operador-1") },
    permisosPorSede: new Map(
      sedes.map((sede) => [id<"Sede">(sede), new Set(["centros.ver" as const])]),
    ),
  };
}

async function altaDePrueba(nombres: string[] = ["Norte", "Sur"]) {
  const centroId = randomUUID();
  const sedes = nombres.map((nombre, indice) => ({
    id: randomUUID(),
    nombre,
    esCentral: indice === 0,
  }));
  const ctx = contexto(
    centroId,
    sedes.map((sede) => sede.id),
  );
  const resultado = await enContexto(base, ctx, (tx) =>
    crearCentro(tx, { id: centroId, nombre: "Centro de prueba", sedes }),
  );
  return { centroId, sedes, ctx, resultado };
}

describe("crearCentro", () => {
  it("crea el centro con sus sedes y la zona horaria por defecto", async () => {
    const { ctx, resultado } = await altaDePrueba();
    expect(resultado.ok).toBe(true);
    const centro = await enContexto(base, ctx, (tx) => obtenerCentro(tx));
    expect(centro).toMatchObject({
      nombre: "Centro de prueba",
      zonaHoraria: "America/Argentina/Buenos_Aires",
    });
    const sedes = await enContexto(base, ctx, (tx) => listarSedes(tx));
    expect(sedes.map((sede) => [sede.nombre, sede.esCentral])).toEqual([
      ["Norte", true],
      ["Sur", false],
    ]);
  });

  it("rechaza un nombre vacío y una zona horaria que no existe", async () => {
    const centroId = randomUUID();
    const ctx = contexto(centroId, []);
    const vacio = await enContexto(base, ctx, (tx) =>
      crearCentro(tx, { id: centroId, nombre: "  ", sedes: [] }),
    );
    const zona = await enContexto(base, ctx, (tx) =>
      crearCentro(tx, { id: centroId, nombre: "X", zonaHoraria: "Marte/Olympus", sedes: [] }),
    );
    expect(vacio).toMatchObject({ ok: false, error: { codigo: "nombre-vacio" } });
    expect(zona).toMatchObject({ ok: false, error: { codigo: "zona-horaria-invalida" } });
  });

  it("no permite dos sedes con el mismo nombre ni dos sedes centrales", async () => {
    const repetida = await altaDePrueba(["Norte", "Norte"]);
    expect(repetida.resultado).toMatchObject({ ok: false, error: { codigo: "sede-repetida" } });

    const centroId = randomUUID();
    const sedes = [
      { id: randomUUID(), nombre: "A", esCentral: true },
      { id: randomUUID(), nombre: "B", esCentral: true },
    ];
    const dosCentrales = await enContexto(base, contexto(centroId, []), (tx) =>
      crearCentro(tx, { id: centroId, nombre: "X", sedes }),
    );
    expect(dosCentrales).toMatchObject({ ok: false, error: { codigo: "una-sola-central" } });
  });
});

describe("aislamiento", () => {
  it("un centro no ve las sedes de otro", async () => {
    const a = await altaDePrueba();
    const b = await altaDePrueba(["Oeste"]);
    const visiblesDeA = await enContexto(base, a.ctx, (tx) => listarSedes(tx));
    expect(visiblesDeA.map((sede) => sede.nombre)).toEqual(["Norte", "Sur"]);
    const visiblesDeB = await enContexto(base, b.ctx, (tx) => listarSedes(tx));
    expect(visiblesDeB.map((sede) => sede.nombre)).toEqual(["Oeste"]);
  });

  it("se ven solo las sedes donde se tiene algún permiso", async () => {
    const { centroId, sedes } = await altaDePrueba();
    const soloNorte = contexto(centroId, [sedes[0]?.id ?? ""]);
    const visibles = await enContexto(base, soloNorte, (tx) => listarSedes(tx));
    expect(visibles.map((sede) => sede.nombre)).toEqual(["Norte"]);
  });
});

describe("renombrarSede", () => {
  it("renombra con la versión vigente y avisa si cambió mientras se editaba (0013)", async () => {
    const { sedes, ctx } = await altaDePrueba();
    const sedeId = id<"Sede">(sedes[0]?.id ?? "") satisfies SedeId;

    const primero = await enContexto(base, ctx, (tx) =>
      renombrarSede(tx, { sedeId, nombre: "Norte Centro", version: 1 }),
    );
    const segundo = await enContexto(base, ctx, (tx) =>
      renombrarSede(tx, { sedeId, nombre: "Otro nombre", version: 1 }),
    );

    expect(primero).toEqual({ ok: true, valor: { version: 2 } });
    expect(segundo).toMatchObject({ ok: false, error: { codigo: "cambio-concurrente" } });
  });
});
