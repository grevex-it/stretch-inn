// Las clases dictadas por cada profe en un período (0022): a los profes se les paga por clase.
// Cuenta las fechas que ya terminaron y no se cancelaron, con su reemplazo si lo tuvieron, y arma
// las que falten. Sobre Postgres real, con RLS.
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
const DIA = 86_400_000;
const diaMas = (dia: string, dias: number) =>
  new Date(Date.parse(`${dia}T12:00:00Z`) + dias * DIA).toISOString().slice(0, 10);

async function profe(ctx: ContextoCentro, nombre: string): Promise<string> {
  const [cuenta, usuario] = [randomUUID(), randomUUID()];
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, 'x', false)",
    [cuenta, `${cuenta}@prueba.com`],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, $4)",
    [usuario, ctx.centroId, cuenta, nombre],
  );
  return usuario;
}

/**
 * Stretching los lunes con Lore y Yoga los miércoles sin profe, en Norte. El período son las tres
 * semanas desde el lunes que viene; el reloj del reporte, cinco semanas adelante.
 */
async function escenario() {
  const centro = await centroConDosSedes(base, { norte: TODO, sur: ["agenda.ver"] });
  const { ctx, norte } = centro;
  const [lore, lucia] = [await profe(ctx, "Lore"), await profe(ctx, "Lucía")];
  await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte, profeId: lore });
  await agenda.crearClase(ctx, {
    ...STRETCHING,
    nombre: "Yoga",
    dia: 3,
    sedeId: norte,
    profeId: null,
  });
  const desde = lunesDe(new Date(Date.now() + 7 * DIA));
  const despues = crearAgenda(base, { ahora: () => new Date(Date.now() + 35 * DIA) });
  return { ...centro, lore, lucia, desde, hasta: diaMas(desde, 20), despues };
}

async function lunes(ctx: ContextoCentro, sedeId: string, dia: string) {
  const semana = await agenda.semana(ctx, { ...PRIMERA, sedeId, desde: dia });
  const fecha = semana.ok ? semana.valor.elementos.find((f) => f.fecha === dia) : undefined;
  if (fecha === undefined) throw new Error(`No está el lunes ${dia}.`);
  return fecha;
}

describe("clasesDictadas", () => {
  it("cuenta por profe las fechas dadas, con reemplazos, sin canceladas y las sin profe aparte", async () => {
    const { ctx, norte, lore, lucia, desde, hasta, despues } = await escenario();
    // Primer lunes: lo da Lucía. Tercer lunes: se cancela.
    const primero = await lunes(ctx, norte, desde);
    await agenda.fijarProfeDeFecha(ctx, { id: primero.id, profeId: lucia });
    const tercero = await lunes(ctx, norte, diaMas(desde, 14));
    await agenda.fijarCancelada(ctx, { id: tercero.id, cancelada: true });

    const dictadas = await despues.clasesDictadas(ctx, { sedeId: norte, desde, hasta });

    expect(dictadas).toEqual({
      ok: true,
      valor: {
        profes: [
          { profeId: lore, nombre: "Lore", clases: 1 },
          { profeId: lucia, nombre: "Lucía", clases: 1 },
        ],
        sinProfe: 3,
      },
    });
  });

  it("las fechas que todavía no terminaron no cuentan", async () => {
    const { ctx, norte, desde, hasta } = await escenario();

    const hoy = await agenda.clasesDictadas(ctx, { sedeId: norte, desde, hasta });

    expect(hoy).toEqual({ ok: true, valor: { profes: [], sinProfe: 0 } });
  });

  it("pide gestionar la agenda en la sede y un período de hasta 62 días", async () => {
    const { ctx, norte, sur, desde } = await escenario();

    const enSur = await agenda.clasesDictadas(ctx, { sedeId: sur, desde, hasta: desde });
    expect(!enSur.ok && enSur.error.codigo).toBe("sin-permiso");
    const alReves = await agenda.clasesDictadas(ctx, {
      sedeId: norte,
      desde,
      hasta: diaMas(desde, -1),
    });
    expect(!alReves.ok && alReves.error.codigo).toBe("periodo-invalido");
    const largo = await agenda.clasesDictadas(ctx, {
      sedeId: norte,
      desde,
      hasta: diaMas(desde, 62),
    });
    expect(!largo.ok && largo.error.codigo).toBe("periodo-invalido");
  });
});
