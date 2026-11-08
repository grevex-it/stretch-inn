// El período de una cuota: [SUPUESTO] el mes calendario en la zona del centro, AAAA-MM. Puro.

/** El mes local del centro en ese instante. */
export function periodoDe(instante: Date, zona: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}`;
}

export function esPeriodo(texto: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}

/** El mes anterior de un período válido: el de las cuotas que se renuevan. */
export function periodoAnterior(periodo: string): string {
  const [anio = 0, mes = 1] = periodo.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}
