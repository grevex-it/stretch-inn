// Cómo se muestra una cuota (0020): un paquete de clases que cuenta desde un día. Cuándo termina
// lo dicen las fechas del horario fijo del alumno. Los días ya vienen en la zona del centro.

const dia = (texto: string) => {
  const [anio, mes, d] = texto.split("-");
  return `${d ?? ""}/${mes ?? ""}/${anio ?? ""}`;
};

export function textoDelCiclo({ desde, clases }: { desde: string; clases: number }): string {
  return `Desde el ${dia(desde)} · ${String(clases)} ${clases === 1 ? "clase" : "clases"}`;
}
