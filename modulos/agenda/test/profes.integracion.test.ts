// El profe de cada clase (0022): un usuario del equipo. Cada sede tiene su profe fijo, que es el
// de sus clases nuevas; una fecha puede tener un reemplazo, y cambiar el profe de la clase no
// cambia quién dio las fechas que ya pasaron. Sobre Postgres real, con RLS.
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, type Agenda } from "../src/index.ts";
import { centroConDosSedes, comoDueno, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

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
const SEMANA = 7 * 86_400_000;

/** Un usuario más del equipo del centro, sin permisos: un profe. */
async function profe(ctx: ContextoCentro, nombre: string, activo = true): Promise<string> {
  const [cuenta, usuario] = [randomUUID(), randomUUID()];
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, 'x', false)",
    [cuenta, `${cuenta}@prueba.com`],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre, activo) values ($1, $2, $3, $4, $5)",
    [usuario, ctx.centroId, cuenta, nombre, activo],
  );
  return usuario;
}

async function clase(a: Agenda, ctx: ContextoCentro, sedeId: string, profeId?: string | null) {
  const creada = await a.crearClase(ctx, {
    ...STRETCHING,
    sedeId,
    ...(profeId === undefined ? {} : { profeId }),
  });
  if (!creada.ok) throw new Error(creada.error.mensaje);
  return creada.valor.id;
}

async function deLaClase(a: Agenda, ctx: ContextoCentro, sedeId: string, id: string) {
  const lista = await a.clases(ctx, { ...PRIMERA, sedeId });
  const suya = lista.ok ? lista.valor.elementos.find((c) => c.id === id) : undefined;
  if (suya === undefined) throw new Error("No está la clase.");
  return suya;
}

async function fechaDe(a: Agenda, ctx: ContextoCentro, sedeId: string, semanas = 1) {
  const semana = await a.semana(ctx, {
    ...PRIMERA,
    sedeId,
    desde: lunesDe(new Date(Date.now() + semanas * SEMANA)),
  });
  const fecha = semana.ok ? semana.valor.elementos[0] : undefined;
  if (fecha === undefined) throw new Error("Falta la fecha.");
  return fecha;
}

const centro = () => centroConDosSedes(base, { norte: TODO, sur: ["agenda.ver"] });

describe("profe fijo de la sede", () => {
  it("sin configurar no hay; se fija con un usuario activo del centro", async () => {
    const { ctx, norte } = await centro();
    const lore = await profe(ctx, "Lore");

    expect(await agenda.profeDeSede(ctx, { sedeId: norte })).toEqual({ ok: true, valor: null });
    expect((await agenda.fijarProfeDeSede(ctx, { sedeId: norte, profeId: lore })).ok).toBe(true);
    expect(await agenda.profeDeSede(ctx, { sedeId: norte })).toEqual({ ok: true, valor: lore });
    expect((await agenda.fijarProfeDeSede(ctx, { sedeId: norte, profeId: null })).ok).toBe(true);
  });

  it("no acepta un usuario de otro centro, inexistente ni inactivo, ni otra sede", async () => {
    const { ctx, norte, sur } = await centro();
    const otro = await centro();
    const ajeno = await profe(otro.ctx, "Ajena");
    const inactiva = await profe(ctx, "Inactiva", false);

    for (const profeId of [ajeno, randomUUID(), inactiva]) {
      const fijado = await agenda.fijarProfeDeSede(ctx, { sedeId: norte, profeId });
      expect(!fijado.ok && fijado.error.codigo).toBe("profe-invalido");
    }
    const enSur = await agenda.fijarProfeDeSede(ctx, { sedeId: sur, profeId: null });
    expect(!enSur.ok && enSur.error.codigo).toBe("sin-permiso");
  });
});

describe("profe de la clase", () => {
  it("sin profe, la clase nueva toma el fijo de la sede; con profe, ese", async () => {
    const { ctx, norte } = await centro();
    const [lore, lucia] = [await profe(ctx, "Lore"), await profe(ctx, "Lucía")];
    await agenda.fijarProfeDeSede(ctx, { sedeId: norte, profeId: lore });

    const porDefecto = await clase(agenda, ctx, norte);
    const propia = await clase(agenda, ctx, norte, lucia);
    const sinProfe = await clase(agenda, ctx, norte, null);

    expect((await deLaClase(agenda, ctx, norte, porDefecto)).profeId).toBe(lore);
    expect((await deLaClase(agenda, ctx, norte, propia)).profeId).toBe(lucia);
    expect((await deLaClase(agenda, ctx, norte, sinProfe)).profeId).toBeNull();
    const invalida = await agenda.crearClase(ctx, {
      ...STRETCHING,
      sedeId: norte,
      profeId: randomUUID(),
    });
    expect(!invalida.ok && invalida.error.codigo).toBe("profe-invalido");
  });

  it("cada fecha muestra su profe; un reemplazo cambia solo esa fecha", async () => {
    const { ctx, norte } = await centro();
    const [lore, lucia] = [await profe(ctx, "Lore"), await profe(ctx, "Lucía")];
    await clase(agenda, ctx, norte, lore);
    const primera = await fechaDe(agenda, ctx, norte, 1);
    expect(primera.profeId).toBe(lore);

    const reemplazo = await agenda.fijarProfeDeFecha(ctx, { id: primera.id, profeId: lucia });
    expect(reemplazo.ok).toBe(true);

    expect((await fechaDe(agenda, ctx, norte, 1)).profeId).toBe(lucia);
    expect((await fechaDe(agenda, ctx, norte, 2)).profeId).toBe(lore);
  });

  it("cambiar el profe de la clase no cambia quién dio las fechas que ya pasaron", async () => {
    const { ctx, norte } = await centro();
    const [lore, lucia] = [await profe(ctx, "Lore"), await profe(ctx, "Lucía")];
    const id = await clase(agenda, ctx, norte, lore);
    const pasada = await fechaDe(agenda, ctx, norte, 1);
    // Desde un reloj dos semanas adelante, la fecha de la semana que viene ya pasó.
    const despues = crearAgenda(base, { ahora: () => new Date(Date.now() + 2 * SEMANA) });
    const { version, nombre, dia, hora, duracionMinutos, cupo } = await deLaClase(
      agenda,
      ctx,
      norte,
      id,
    );

    const editada = await despues.editarClase(ctx, {
      id,
      version,
      nombre,
      dia,
      hora,
      duracionMinutos,
      cupo,
      profeId: lucia,
    });

    expect(editada.ok).toBe(true);
    expect((await fechaDe(agenda, ctx, norte, 1)).id).toBe(pasada.id);
    expect((await fechaDe(agenda, ctx, norte, 1)).profeId).toBe(lore);
    expect((await fechaDe(agenda, ctx, norte, 3)).profeId).toBe(lucia);
  });
});
