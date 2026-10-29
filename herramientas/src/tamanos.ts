export interface Archivo {
  ruta: string;
  contenido: string;
}

export interface Excedido {
  ruta: string;
  lineas: number;
}

const EXTENSIONES_CONTROLADAS = /\.(ts|tsx|mts|js|mjs|cjs|jsx|css)$/;
const EXCLUIDOS = [/^db\/migraciones\//];

export const LIMITE_LINEAS = 300;

function controlado(ruta: string): boolean {
  return EXTENSIONES_CONTROLADAS.test(ruta) && !EXCLUIDOS.some((patron) => patron.test(ruta));
}

function lineasConContenido(contenido: string): number {
  return contenido.split("\n").filter((linea) => linea.trim() !== "").length;
}

export function excedidos(archivos: Archivo[], limite: number): Excedido[] {
  return archivos
    .filter((archivo) => controlado(archivo.ruta))
    .map((archivo) => ({ ruta: archivo.ruta, lineas: lineasConContenido(archivo.contenido) }))
    .filter((archivo) => archivo.lineas > limite);
}
