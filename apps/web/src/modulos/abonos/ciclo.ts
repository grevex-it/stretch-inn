// Cómo se muestra el ciclo de 4 semanas de una cuota (0019). `hasta` es el día en que empieza el
// siguiente: el último día del ciclo es el anterior. Los días ya vienen en la zona del centro.

const dia = (texto: string) => {
  const [anio, mes, d] = texto.split("-");
  return `${d ?? ""}/${mes ?? ""}/${anio ?? ""}`;
};

export function textoDelCiclo({ desde, hasta }: { desde: string; hasta: string }): string {
  const ultimo = new Date(`${hasta}T00:00:00Z`);
  ultimo.setUTCDate(ultimo.getUTCDate() - 1);
  return `Del ${dia(desde)} al ${dia(ultimo.toISOString().slice(0, 10))}`;
}
