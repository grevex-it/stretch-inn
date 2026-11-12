// Reglas del cobro. Puro. Los montos los define la cuota (abonos); acá, cómo se registra.
import { falla, ok, type Resultado } from "@app/nucleo";

export type ErrorDeCobro = "clave-invalida" | "motivo-vacio" | "medio-invalido";

/** Los medios de pago que usa Stretch Inn (0019). Otro medio se suma cuando un centro lo use. */
export const MEDIOS = ["efectivo", "transferencia"] as const;
export type Medio = (typeof MEDIOS)[number];

export function medioValido(medio: string): medio is Medio {
  return (MEDIOS as readonly string[]).includes(medio);
}

/** La clave de idempotencia (regla 7): la arma el panel, una por intento de cobro. */
export function limpiarClave(clave: string): Resultado<string, ErrorDeCobro> {
  const limpia = clave.trim();
  if (limpia.length < 8 || limpia.length > 100) {
    return falla("clave-invalida", "Falta la clave del cobro: volvé a intentarlo.");
  }
  return ok(limpia);
}

export function limpiarMotivo(motivo: string): Resultado<string, ErrorDeCobro> {
  const limpio = motivo.trim();
  if (limpio === "") return falla("motivo-vacio", "Contá por qué se anula el pago.");
  return ok(limpio);
}

/** Cuántos milisegundos adelanta la hora local de la zona respecto de UTC en ese instante. */
function adelanto(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const n = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return local - Math.floor(instante.getTime() / 1000) * 1000;
}

/** La medianoche local de ese día, en UTC (dos pasadas por si cae en un cambio de horario). */
function medianoche(dia: string, zona: string): Date {
  const [anio, mes, d] = dia.split("-").map(Number) as [number, number, number];
  const comoUtc = Date.UTC(anio, mes - 1, d);
  const primera = comoUtc - adelanto(new Date(comoUtc), zona);
  return new Date(comoUtc - adelanto(new Date(primera), zona));
}

/** El día de caja: de medianoche a medianoche en la zona del centro, en UTC. */
export function diaDeCaja(dia: string, zona: string): { desde: Date; hasta: Date } {
  const siguiente = new Date(`${dia}T12:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return {
    desde: medianoche(dia, zona),
    hasta: medianoche(siguiente.toISOString().slice(0, 10), zona),
  };
}
