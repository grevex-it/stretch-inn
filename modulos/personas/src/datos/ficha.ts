// Limpieza y validación de la ficha del alumno, y el texto que compara el buscador. Puro: sin base.
import { falla, ok, type Resultado } from "@app/nucleo";
import type { DatosDeAlumno, ErrorDeAlumno } from "./tipos.ts";

const MINIMO_DE_DIGITOS = 6;

const digitos = (texto: string) => texto.replace(/\D/g, "");

/** Minúsculas y sin acentos: «Pérez» y «perez» son lo mismo para buscar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR");
}

function fechaValida(fecha: string, hoy: Date): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (anio === undefined || mes === undefined || dia === undefined) return false;
  const valor = new Date(Date.UTC(anio, mes - 1, dia));
  const existe = valor.getUTCFullYear() === anio && valor.getUTCMonth() === mes - 1;
  return existe && valor.getUTCDate() === dia && anio >= 1900 && valor <= hoy;
}

const vacioANull = (texto: string | null) => (texto === null || texto === "" ? null : texto);

/** Recorta y normaliza: lo opcional vacío queda en null, el documento sin puntos ni espacios. */
function normalizarFicha(datos: DatosDeAlumno): DatosDeAlumno {
  return {
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    telefono: datos.telefono.trim(),
    documento: vacioANull(datos.documento?.replace(/[\s.-]/g, "").toUpperCase() ?? null),
    email: vacioANull(datos.email?.trim().toLowerCase() ?? null),
    fechaNacimiento: vacioANull(datos.fechaNacimiento?.trim() ?? null),
    notas: datos.notas.trim(),
  };
}

/** La ficha recortada y normalizada, o la primera regla que no cumple. */
export function limpiarFicha(
  datos: DatosDeAlumno,
  hoy = new Date(),
): Resultado<DatosDeAlumno, ErrorDeAlumno> {
  const ficha = normalizarFicha(datos);
  if (ficha.nombre === "" || ficha.apellido === "") {
    return falla("nombre-vacio", "Escribí el nombre y el apellido.");
  }
  if (digitos(ficha.telefono).length < MINIMO_DE_DIGITOS) {
    return falla("telefono-invalido", "Revisá el teléfono: tiene que tener al menos 6 números.");
  }
  if (ficha.fechaNacimiento !== null && !fechaValida(ficha.fechaNacimiento, hoy)) {
    return falla("fecha-invalida", "Revisá la fecha de nacimiento.");
  }
  return ok(ficha);
}

/** Lo que se guarda en `busqueda`. */
export function textoDeBusqueda(ficha: DatosDeAlumno): string {
  const partes = [ficha.nombre, ficha.apellido, ficha.documento ?? "", digitos(ficha.telefono)];
  return normalizar(partes.join(" "));
}

/**
 * Cada palabra buscada, normalizada como `busqueda`, sin puntos, guiones ni paréntesis (para
 * documentos y teléfonos) y con `%`, `_` y `\` escapados: no funcionan como comodines.
 */
export function terminosDeBusqueda(buscar: string): string[] {
  return normalizar(buscar)
    .split(/\s+/)
    .map((termino) => termino.replace(/[.()-]/g, ""))
    .filter((termino) => termino !== "")
    .map((termino) => termino.replace(/[\\%_]/g, (caracter) => `\\${caracter}`));
}
