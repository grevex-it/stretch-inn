// Cola persistente sobre el mismo Postgres (pg-boss). Ver docs/decisiones/0003, 0004 y 0013.
// El esquema lo instala `pnpm db:migrar`; la app solo lo usa.
import { createHash } from "node:crypto";
import { PgBoss } from "pg-boss";
import type { Transaccion } from "./base.ts";
import type { Logger } from "./logs.ts";

/** Lista de fallidos: lo que agotó sus reintentos queda acá para revisarlo, no se pierde. */
export const COLA_FALLIDOS = "fallidos";

export interface Cola {
  readonly boss: PgBoss;
  iniciar(): Promise<void>;
  detener(): Promise<void>;
}

export interface OpcionesCola {
  url: string;
  logger: Logger;
}

export function crearCola({ url, logger }: OpcionesCola): Cola {
  const boss = new PgBoss({
    connectionString: url,
    schema: "pgboss",
    migrate: false,
    createSchema: false,
  });
  boss.on("error", (error) => {
    logger.error({ err: error }, "Falla interna de la cola.");
  });
  return {
    boss,
    iniciar: async () => {
      await boss.start();
      if ((await boss.getQueue(COLA_FALLIDOS)) === null) await boss.createQueue(COLA_FALLIDOS);
    },
    detener: () => boss.stop(),
  };
}

export interface OpcionesTarea {
  /** Reintentos después del primer intento. Por defecto, 5. */
  reintentos?: number;
  /** Espera antes del primer reintento; después crece (backoff). Por defecto, 30. */
  esperaSegundos?: number;
}

/** Declara la cola de una tarea. Se puede llamar en cada arranque. */
export async function declararTarea(
  cola: Cola,
  nombre: string,
  { reintentos = 5, esperaSegundos = 30 }: OpcionesTarea = {},
): Promise<void> {
  const opciones = {
    retryLimit: reintentos,
    retryDelay: esperaSegundos,
    retryBackoff: esperaSegundos > 0,
    deadLetter: COLA_FALLIDOS,
  };
  if ((await cola.boss.getQueue(nombre)) === null) await cola.boss.createQueue(nombre, opciones);
  else await cola.boss.updateQueue(nombre, opciones);
}

export interface OpcionesPublicar {
  /** El mismo pedido repetido (doble clic, reintento) se encola una sola vez (0013). */
  claveIdempotencia?: string;
}

/**
 * Id del trabajo derivado de la tarea y la clave (UUID con forma de versión 8): pg-boss ignora un
 * id repetido, así que el mismo pedido se encola una sola vez mientras el trabajo exista.
 */
function idDeClave(nombre: string, clave: string): string {
  const hex = createHash("sha256")
    .update(JSON.stringify([nombre, clave]))
    .digest("hex");
  const variante = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variante}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Encola un evento o tarea dentro de la transacción del cambio de datos: si la transacción se
 * deshace, el evento tampoco queda (outbox).
 */
export async function publicar(
  cola: Cola,
  tx: Transaccion,
  nombre: string,
  datos: object,
  { claveIdempotencia }: OpcionesPublicar = {},
): Promise<void> {
  await cola.boss.send(nombre, datos, {
    db: { executeSql: (texto, valores) => tx.$client.query(texto, valores) },
    ...(claveIdempotencia === undefined ? {} : { id: idDeClave(nombre, claveIdempotencia) }),
  });
}

/** Procesa una tarea. El manejador tiene que poder ejecutarse dos veces sin efecto doble. */
export async function trabajar(
  cola: Cola,
  nombre: string,
  manejador: (datos: unknown) => Promise<void>,
): Promise<void> {
  await cola.boss.work(nombre, { pollingIntervalSeconds: 1 }, async ([trabajo]) => {
    if (trabajo !== undefined) await manejador(trabajo.data);
  });
}
