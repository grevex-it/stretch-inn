// Las tareas del worker sobre Postgres real: declara sus colas y procesa PagoRegistrado; un evento
// mal formado no se procesa (va a reintentos y después a fallidos).
import type {} from "@app/db/pruebas";
import { EVENTO_PAGO_REGISTRADO } from "@app/caja";
import { id, type ContextoCentro } from "@app/nucleo";
import {
  crearBase,
  crearCola,
  crearLogger,
  enContexto,
  publicar,
  type Base,
  type Cola,
} from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { registrarTareas } from "../src/tareas.ts";

const lineas: string[] = [];
const logger = crearLogger({ nivel: "info", destino: { write: (linea) => lineas.push(linea) } });
const ctx: ContextoCentro = {
  centroId: id<"Centro">(randomUUID()),
  actor: { tipo: "usuario", usuarioId: id<"Usuario">(randomUUID()) },
  permisosPorSede: new Map(),
};

let base: Base;
let cola: Cola;
beforeAll(async () => {
  base = crearBase(inject("urlApp"));
  cola = crearCola({ url: inject("urlApp"), logger });
  await cola.iniciar();
  await registrarTareas(cola, logger);
});
afterAll(async () => {
  await cola.detener();
  await base.cerrar();
});

function hastaQue(condicion: () => boolean, segundos = 15): Promise<void> {
  const limite = Date.now() + segundos * 1000;
  return new Promise((listo, falla) => {
    const revisar = () => {
      if (condicion()) listo();
      else if (Date.now() > limite) falla(new Error("No pasó a tiempo."));
      else setTimeout(revisar, 100);
    };
    revisar();
  });
}

describe("PagoRegistrado", () => {
  it("el worker lo procesa y deja constancia en el log con el pago", async () => {
    const pagoId = randomUUID();
    await enContexto(base, ctx, (tx) =>
      publicar(cola, tx, EVENTO_PAGO_REGISTRADO, {
        pagoId,
        centroId: ctx.centroId,
        sedeId: randomUUID(),
        alumnoId: randomUUID(),
        cuotaId: randomUUID(),
        monto: 30_000,
        medio: "efectivo",
        registradoEn: new Date().toISOString(),
      }),
    );
    await hastaQue(() => lineas.some((l) => l.includes(pagoId) && l.includes("Pago registrado")));
    const linea = lineas.find((l) => l.includes(pagoId)) ?? "{}";
    expect(JSON.parse(linea)).toMatchObject({
      level: "info",
      evento: EVENTO_PAGO_REGISTRADO,
      pagoId,
      monto: 30_000,
    });
  });
});
