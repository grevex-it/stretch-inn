// La tarifa por clase de los profes (0024). Puro. Cuatro niveles, y gana el más específico que
// exista: profe y sede, profe, sede, centro. Cada tarifa rige desde una fecha y una nueva cierra la
// anterior del mismo alcance el día antes; cada clase se paga con la vigente el día en que se dictó.
import { falla, ok, type Resultado } from "@app/nucleo";

export interface Tarifa {
  /** null: para todos los profes. */
  profeId: string | null;
  /** null: para todas las sedes. */
  sedeId: string | null;
  /** Pesos enteros por clase (0009). */
  monto: number;
  /** AAAA-MM-DD: desde qué día rige. */
  desde: string;
  /** AAAA-MM-DD: el último día que rige; null mientras no la reemplace otra. */
  hasta: string | null;
}

export type ErrorDeTarifa =
  "monto-invalido" | "desde-invalido" | "desde-pasado" | "desde-pisa-la-anterior";

const MONTO_MAXIMO = 100_000_000;
const DIA = 86_400_000;

/** El nivel de una tarifa: cuanto más alto, más específica. */
function nivel(tarifa: Tarifa): number {
  return (tarifa.profeId === null ? 0 : 2) + (tarifa.sedeId === null ? 0 : 1);
}

function aplica(tarifa: Tarifa, { fecha, profeId, sedeId }: DiaDeClase): boolean {
  return (
    (tarifa.profeId === null || tarifa.profeId === profeId) &&
    (tarifa.sedeId === null || tarifa.sedeId === sedeId) &&
    tarifa.desde <= fecha &&
    (tarifa.hasta === null || fecha <= tarifa.hasta)
  );
}

export interface DiaDeClase {
  /** AAAA-MM-DD. */
  fecha: string;
  profeId: string;
  sedeId: string;
}

/** El monto por clase de ese profe en esa sede ese día, o undefined si ninguna tarifa aplica. */
export function tarifaDelDia(tarifas: readonly Tarifa[], dia: DiaDeClase): number | undefined {
  let mejor: Tarifa | undefined;
  for (const tarifa of tarifas) {
    if (aplica(tarifa, dia) && (mejor === undefined || nivel(tarifa) > nivel(mejor)))
      mejor = tarifa;
  }
  return mejor?.monto;
}

const diaAntes = (dia: string) =>
  new Date(Date.parse(`${dia}T00:00:00Z`) - DIA).toISOString().slice(0, 10);

function esDia(texto: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
    new Date(`${texto}T00:00:00Z`).toISOString().startsWith(texto)
  );
}

/**
 * Si una tarifa nueva puede reemplazar a la vigente del mismo alcance, y qué día se cierra esa.
 * **[SUPUESTO, 0024]** Sin aumentos hacia atrás: rige desde hoy o más adelante.
 */
export function vigenciaNueva(
  anterior: Tarifa | undefined,
  { desde, monto }: { desde: string; monto: number },
  hoy: string,
): Resultado<{ cerrarAnteriorEl: string | null }, ErrorDeTarifa> {
  if (!Number.isInteger(monto) || monto < 1 || monto > MONTO_MAXIMO) {
    return falla("monto-invalido", "El monto por clase va en pesos enteros, mayor que cero.");
  }
  if (!esDia(desde)) return falla("desde-invalido", "Revisá desde qué día rige.");
  if (desde < hoy) {
    return falla(
      "desde-pasado",
      "La tarifa rige desde hoy o más adelante: no hay aumentos hacia atrás.",
    );
  }
  if (anterior !== undefined && desde <= anterior.desde) {
    return falla(
      "desde-pisa-la-anterior",
      "La tarifa nueva tiene que empezar después de la que está vigente.",
    );
  }
  return ok({ cerrarAnteriorEl: anterior === undefined ? null : diaAntes(desde) });
}
