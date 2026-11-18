// Crear o editar una clase mientras otro cambia las camas de la sede: espera a que termine y valida
// contra las camas nuevas. El cambio de camas en curso se simula con una transacción del dueño que
// toma el bloqueo exclusivo de la sede (el de fijarCamas) y escribe las camas. Sobre Postgres real.
import { crearBase, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
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

/** Una transacción del dueño con el bloqueo de camas de la sede tomado, sin confirmar. */
async function conBloqueo(
  sedeId: string,
  funcion: "pg_advisory_xact_lock" | "pg_advisory_xact_lock_shared",
) {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  await cliente.query("begin");
  await cliente.query(`select ${funcion}(hashtextextended($1, 0))`, [`camas:${sedeId}`]);
  return {
    cliente,
    async confirmar() {
      await cliente.query("commit");
      await cliente.end();
    },
  };
}

/** Un cambio de camas en curso: bloqueo exclusivo y las camas escritas sin confirmar. */
async function cambioDeCamasEnCurso(sedeId: string, camas: number) {
  const transaccion = await conBloqueo(sedeId, "pg_advisory_xact_lock");
  await transaccion.cliente.query(
    `insert into camas_de_sede (sede_id, centro_id, camas)
     select id, centro_id, $2 from sedes where id = $1`,
    [sedeId, camas],
  );
  return transaccion;
}

/** Un alta o edición en curso: bloqueo compartido. */
const altaEnCurso = (sedeId: string) => conBloqueo(sedeId, "pg_advisory_xact_lock_shared");

const ESPERA = 500;

/** Si la promesa sigue sin terminar después de la espera. */
async function sigueEsperando(promesa: Promise<unknown>): Promise<boolean> {
  const espera = new Promise<"esperando">((listo) =>
    setTimeout(() => {
      listo("esperando");
    }, ESPERA),
  );
  return (await Promise.race([promesa.then(() => "termino"), espera])) === "esperando";
}

describe("camas de la sede con altas y ediciones a la vez", () => {
  it("crear una clase espera al cambio de camas y valida contra las nuevas", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const cambio = await cambioDeCamasEnCurso(norte, 10);

    const alta = agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte, cupo: 12 });

    const esperaba = await sigueEsperando(alta);
    await cambio.confirmar();
    const resultado = await alta;
    expect(esperaba).toBe(true);
    expect(!resultado.ok && resultado.error.codigo).toBe("cupo-mayor-que-camas");
  });

  it("editar una clase espera al cambio de camas y valida contra las nuevas", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const creada = await agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte, cupo: 8 });
    if (!creada.ok) throw new Error(creada.error.mensaje);
    const { nombre, dia, hora, duracionMinutos } = STRETCHING;
    const cambio = await cambioDeCamasEnCurso(norte, 10);

    const edicion = agenda.editarClase(ctx, {
      id: creada.valor.id,
      version: 1,
      nombre,
      dia,
      hora,
      duracionMinutos,
      cupo: 12,
    });

    const esperaba = await sigueEsperando(edicion);
    await cambio.confirmar();
    const resultado = await edicion;
    expect(esperaba).toBe(true);
    expect(!resultado.ok && resultado.error.codigo).toBe("cupo-mayor-que-camas");
  });

  it("dos altas en la misma sede no se esperan entre sí", async () => {
    const { ctx, norte } = await centroConDosSedes(base, { norte: TODO, sur: [] });
    const otraAlta = await altaEnCurso(norte);

    const alta = agenda.crearClase(ctx, { ...STRETCHING, sedeId: norte });

    const esperaba = await sigueEsperando(alta);
    await otraAlta.confirmar();
    expect(esperaba).toBe(false);
    expect((await alta).ok).toBe(true);
  });
});
