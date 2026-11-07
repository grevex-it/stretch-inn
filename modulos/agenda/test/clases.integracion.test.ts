// Clases semanales sobre Postgres real: alta, edición, baja y permisos por sede (0007).
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";
import { crearAgenda, type Agenda } from "../src/index.ts";
import { centroConDosSedes, STRETCHING, TODO } from "./ayudas.ts";

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

describe("clases", () => {
  it("se crean en una sede y se listan con sus datos", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const creada = await agenda.crearClase(ctx, {
      ...STRETCHING,
      nombre: " Stretching ",
      sedeId: norte,
    });
    if (!creada.ok) throw new Error(creada.error.mensaje);

    const lista = await agenda.clases(ctx, PRIMERA);
    expect(lista).toEqual({
      ok: true,
      valor: {
        ...PRIMERA,
        total: 1,
        elementos: [
          { ...STRETCHING, id: creada.valor.id, sedeId: norte, activa: true, version: 1 },
        ],
      },
    });
  });

  it("cada permiso se controla en la sede de la clase", async () => {
    // Ve las dos sedes, pero la agenda solo en Norte; en Sur tiene otro permiso.
    const { ctx, norte, sur } = await centroConDosSedes(base, {
      norte: TODO,
      sur: ["personas.ver"],
    });
    expect(await agenda.crearClase(ctx, { ...STRETCHING, sedeId: sur })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    expect(await agenda.clases(ctx, { ...PRIMERA, sedeId: sur })).toMatchObject({
      ok: false,
      error: { codigo: "sin-permiso" },
    });
    const soloVer = await centroConDosSedes(base, { norte: ["agenda.ver"], sur: [] });
    expect(
      await agenda.crearClase(soloVer.ctx, { ...STRETCHING, sedeId: soloVer.norte }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
    expect((await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte })).ok).toBe(true);
  });

  it("rechaza una clase inválida con su motivo", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    expect(await agenda.crearClase(ctx, { ...STRETCHING, cupo: 0, sedeId: norte })).toMatchObject({
      ok: false,
      error: { codigo: "cupo-invalido" },
    });
  });

  it("editar compara la versión: con una vieja avisa del cambio", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const creada = await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte });
    if (!creada.ok) throw new Error(creada.error.mensaje);
    const cambio = { ...STRETCHING, id: creada.valor.id, version: 1, cupo: 15 };

    expect(await agenda.editarClase(ctx, cambio)).toEqual({ ok: true, valor: { version: 2 } });
    expect(await agenda.editarClase(ctx, cambio)).toMatchObject({
      ok: false,
      error: { codigo: "cambio-concurrente" },
    });
  });

  it("un centro no ve ni cambia las clases de otro", async () => {
    const propio = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const creada = await agenda.crearClase(propio.ctx, { ...STRETCHING, sedeId: propio.norte });
    if (!creada.ok) throw new Error(creada.error.mensaje);
    const ajeno = await centroConDosSedes(base, { norte: TODO, sur: TODO });

    expect(await agenda.clases(ajeno.ctx, PRIMERA)).toMatchObject({
      ok: true,
      valor: { total: 0 },
    });
    expect(
      await agenda.editarClase(ajeno.ctx, { ...STRETCHING, id: creada.valor.id, version: 1 }),
    ).toMatchObject({ ok: false, error: { codigo: "clase-inexistente" } });
    expect(
      await agenda.crearClase(ajeno.ctx, { ...STRETCHING, sedeId: propio.norte }),
    ).toMatchObject({ ok: false, error: { codigo: "sin-permiso" } });
  });
});
