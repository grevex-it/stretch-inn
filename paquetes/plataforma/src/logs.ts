// Logs en stdout: una línea JSON por log, con el nivel en texto y el mensaje en `message`, para
// que Railway los muestre legibles y filtre por nivel y traza (ver docs/decisiones/0016).
import { randomUUID } from "node:crypto";
import { pino, type DestinationStream, type Level, type Logger } from "pino";

export type { Logger };

/** Datos que nunca se escriben en un log (0015). */
const CAMPOS_SENSIBLES = ["clave", "contrasena", "token", "secreto", "telefono", "authorization"];

export interface OpcionesLogger {
  nivel: Level;
  /** Por defecto, stdout. */
  destino?: DestinationStream;
}

export function crearLogger({ nivel, destino }: OpcionesLogger): Logger {
  const opciones = {
    level: nivel,
    messageKey: "message",
    base: null,
    formatters: { level: (etiqueta: string) => ({ level: etiqueta }) },
    redact: {
      paths: CAMPOS_SENSIBLES.flatMap((campo) => [campo, `*.${campo}`]),
      censor: "[oculto]",
    },
  };
  return destino === undefined ? pino(opciones) : pino(opciones, destino);
}

/** Id de traza de un pedido o tarea, de punta a punta. */
export function nuevaTraza(): string {
  return randomUUID();
}

/** Código corto que ve el usuario («Algo falló. Código: 7F3A9C»): el comienzo de la traza. */
export function codigoDeTraza(traza: string): string {
  return traza.replace(/-/g, "").slice(0, 6).toUpperCase();
}
