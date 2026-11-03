// Cola persistente con pg-boss: outbox en la misma transacción, reintentos y lista de fallidos
// (ver docs/decisiones/0003 y 0013).
import type {} from "@app/db/pruebas";
import { id, type ContextoCentro } from "@app/nucleo";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  COLA_FALLIDOS,
  crearBase,
  crearCola,
  crearLogger,
  declararTarea,
  enContexto,
  publicar,
  trabajar,
  type Base,
  type Cola,
} from "../src/index.ts";

const urlApp = inject("urlApp");
const ctx: ContextoCentro = {
  centroId: id<"Centro">("00000000-0000-4000-a000-00000000000a"),
  actor: { tipo: "usuario", usuarioId: id<"Usuario">("usuario-1") },
  permisosPorSede: new Map(),
};

let base: Base;
let cola: Cola;

beforeAll(async () => {
  base = crearBase(urlApp);
  cola = crearCola({ url: urlApp, logger: crearLogger({ nivel: "fatal" }) });
  await cola.iniciar();
});

afterAll(async () => {
  await cola.detener();
  await base.cerrar();
});

async function datosEncolados(nombre: string): Promise<unknown[]> {
  const trabajos = await cola.boss.fetch(nombre, { batchSize: 10 });
  return trabajos.map((trabajo) => trabajo.data);
}

describe("publicar", () => {
  it("guarda el evento solo si la transacción confirma (outbox)", async () => {
    await declararTarea(cola, "prueba.outbox");
    await enContexto(base, ctx, (tx) => publicar(cola, tx, "prueba.outbox", { n: 1 }));
    await expect(
      enContexto(base, ctx, async (tx) => {
        await publicar(cola, tx, "prueba.outbox", { n: 2 });
        throw new Error("falla después de publicar");
      }),
    ).rejects.toThrow("falla después de publicar");

    expect(await datosEncolados("prueba.outbox")).toEqual([{ n: 1 }]);
  });

  it("con la misma clave de idempotencia encola una sola vez", async () => {
    await declararTarea(cola, "prueba.idempotencia");
    for (let vez = 0; vez < 2; vez++) {
      await enContexto(base, ctx, (tx) =>
        publicar(cola, tx, "prueba.idempotencia", { pago: 7 }, { claveIdempotencia: "pago-7" }),
      );
    }
    expect(await datosEncolados("prueba.idempotencia")).toEqual([{ pago: 7 }]);
  });
});

function esperar<T>(condicion: () => T | undefined, segundos = 15): Promise<T> {
  const limite = Date.now() + segundos * 1000;
  return new Promise((resolver, rechazar) => {
    const revisar = () => {
      const valor = condicion();
      if (valor !== undefined) resolver(valor);
      else if (Date.now() > limite) rechazar(new Error("No pasó a tiempo."));
      else setTimeout(revisar, 100);
    };
    revisar();
  });
}

describe("trabajar", () => {
  it("ejecuta el manejador con los datos publicados", async () => {
    await declararTarea(cola, "prueba.trabajo");
    let recibido: unknown;
    await trabajar(cola, "prueba.trabajo", (datos) => {
      recibido = datos;
      return Promise.resolve();
    });
    await enContexto(base, ctx, (tx) => publicar(cola, tx, "prueba.trabajo", { hola: "mundo" }));
    expect(await esperar(() => recibido)).toEqual({ hola: "mundo" });
  });

  it("lo que falla en todos sus intentos queda en la lista de fallidos", async () => {
    await declararTarea(cola, "prueba.falla", { reintentos: 1, esperaSegundos: 0 });
    let intentos = 0;
    await trabajar(cola, "prueba.falla", () => {
      intentos++;
      return Promise.reject(new Error("WhatsApp no responde"));
    });
    await enContexto(base, ctx, (tx) => publicar(cola, tx, "prueba.falla", { aviso: 1 }));

    let fallidos: unknown[] = [];
    for (let vuelta = 0; vuelta < 80 && fallidos.length === 0; vuelta++) {
      await new Promise((resolver) => setTimeout(resolver, 250));
      fallidos = await datosEncolados(COLA_FALLIDOS);
    }
    expect(intentos).toBe(2);
    expect(fallidos).toEqual([{ aviso: 1 }]);
  });
});
