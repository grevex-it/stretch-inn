// Las fechas concretas de una clase semanal. La clase está en la hora local del centro; cada
// ocurrencia se guarda en UTC (regla 3 de AGENTS.md). Puro: la zona horaria llega de afuera.

/** Día de la semana (1 = lunes … 7 = domingo), hora local `HH:MM` y duración. */
export interface Horario {
  dia: number;
  hora: string;
  duracionMinutos: number;
}

export interface Ocurrencia {
  /** La fecha local del centro, AAAA-MM-DD. */
  fecha: string;
  empiezaEn: Date;
  terminaEn: Date;
}

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

function partes(fecha: string): [number, number, number] {
  const [anio = NaN, mes = NaN, dia = NaN] = fecha.split("-").map(Number);
  return [anio, mes, dia];
}

/** 1 = lunes … 7 = domingo. */
export function diaDe(fecha: string): number {
  const [anio, mes, dia] = partes(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() || 7;
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = partes(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia) + dias * DIA).toISOString().slice(0, 10);
}

/** Cuántos milisegundos está adelantada la zona respecto de UTC en ese instante. */
function desfase(instante: number, zona: string): number {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const valor = (tipo: string) =>
    Number(formato.formatToParts(instante).find((parte) => parte.type === tipo)?.value);
  const comoUtc = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute"),
    valor("second"),
  );
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/** La hora local de esa fecha en la zona, como instante UTC. */
export function localAUtc(fecha: string, hora: string, zona: string): Date {
  const [anio, mes, dia] = partes(fecha);
  const [horas = 0, minutos = 0] = hora.split(":").map(Number);
  const comoSiFueraUtc = Date.UTC(anio, mes - 1, dia, horas, minutos);
  // Dos pasadas: si el desfase cambia justo ahí (horario de verano), la segunda lo corrige.
  const primera = comoSiFueraUtc - desfase(comoSiFueraUtc, zona);
  return new Date(comoSiFueraUtc - desfase(primera, zona));
}

function ocurrenciaEn(fecha: string, horario: Horario, zona: string): Ocurrencia {
  const empiezaEn = localAUtc(fecha, horario.hora, zona);
  return {
    fecha,
    empiezaEn,
    terminaEn: new Date(empiezaEn.getTime() + horario.duracionMinutos * MINUTO),
  };
}

/** La ocurrencia de la clase en los 7 días que empiezan en `desde` (hay una sola). */
export function ocurrenciasDeLaSemana(horario: Horario, desde: string, zona: string): Ocurrencia[] {
  const fecha = sumarDias(desde, (horario.dia - diaDe(desde) + 7) % 7);
  return [ocurrenciaEn(fecha, horario, zona)];
}

/** Las fechas de la clase entre dos días AAAA-MM-DD, inclusive, en orden. */
export function ocurrenciasDelPeriodo(
  horario: Horario,
  desde: string,
  hasta: string,
  zona: string,
): Ocurrencia[] {
  const fechas: Ocurrencia[] = [];
  for (let semana = desde; semana <= hasta; semana = sumarDias(semana, 7)) {
    fechas.push(...ocurrenciasDeLaSemana(horario, semana, zona).filter((o) => o.fecha <= hasta));
  }
  return fechas;
}

/**
 * Qué pasa con las ocurrencias futuras ya guardadas cuando cambia el horario: si siguen en el
 * mismo día, se mueven a la hora nueva; si cambió el día, se borran y se vuelven a armar a pedido.
 */
export function cambioDeHorario(
  futuras: readonly { id: string; fecha: string }[],
  horario: Horario,
  zona: string,
): { actualizar: { id: string; empiezaEn: Date; terminaEn: Date }[]; borrar: string[] } {
  const mismoDia = futuras.filter((o) => diaDe(o.fecha) === horario.dia);
  return {
    actualizar: mismoDia.map(({ id, fecha }) => {
      const { empiezaEn, terminaEn } = ocurrenciaEn(fecha, horario, zona);
      return { id, empiezaEn, terminaEn };
    }),
    borrar: futuras.filter((o) => diaDe(o.fecha) !== horario.dia).map((o) => o.id),
  };
}
