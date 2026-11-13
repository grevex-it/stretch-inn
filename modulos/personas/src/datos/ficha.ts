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

/**
 * Recorta y normaliza: lo opcional vacío queda en null, el documento sin puntos ni espacios. El
 * número de socio y la fecha de inicio que no vienen quedan sin venir (la edición los conserva).
 */
function normalizarFicha(datos: DatosDeAlumno): DatosDeAlumno {
  return { ...normalizarContacto(datos), ...normalizarPlanilla(datos) };
}

/** Lo que no vino queda sin venir; la fecha de inicio vacía, en null. */
function normalizarPlanilla({ numeroDeSocio, fechaDeInicio, profeId }: DatosDeAlumno) {
  return {
    ...(numeroDeSocio === undefined ? {} : { numeroDeSocio }),
    ...(profeId === undefined ? {} : { profeId }),
    ...(fechaDeInicio === undefined ? {} : { fechaDeInicio: vacioANull(fechaDeInicio) }),
  };
}

function normalizarContacto(datos: DatosDeAlumno): DatosDeAlumno {
  return {
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    telefono: vacioANull(datos.telefono?.trim() ?? null),
    documento: vacioANull(datos.documento?.replace(/[\s.-]/g, "").toUpperCase() ?? null),
    email: vacioANull(datos.email?.trim().toLowerCase() ?? null),
    fechaNacimiento: vacioANull(datos.fechaNacimiento?.trim() ?? null),
    notas: datos.notas.trim(),
  };
}

const NUMERO_MAXIMO = 999_999;

/** Las reglas de los datos de la planilla (0022): número de socio y fecha de inicio. */
function reglasDeLaPlanilla(ficha: DatosDeAlumno, hoy: Date): Resultado<null, ErrorDeAlumno> {
  const { numeroDeSocio: numero, fechaDeInicio: inicio } = ficha;
  if (numero != null && !(Number.isInteger(numero) && numero >= 1 && numero <= NUMERO_MAXIMO)) {
    return falla("socio-invalido", "El número de socio va de 1 a 999999.");
  }
  if (inicio != null && !fechaValida(inicio, hoy)) {
    return falla("fecha-invalida", "Revisá la fecha de inicio.");
  }
  return ok(null);
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
  if (ficha.telefono !== null && digitos(ficha.telefono).length < MINIMO_DE_DIGITOS) {
    return falla("telefono-invalido", "Revisá el teléfono: tiene que tener al menos 6 números.");
  }
  if (ficha.fechaNacimiento !== null && !fechaValida(ficha.fechaNacimiento, hoy)) {
    return falla("fecha-invalida", "Revisá la fecha de nacimiento.");
  }
  const planilla = reglasDeLaPlanilla(ficha, hoy);
  return planilla.ok ? ok(ficha) : planilla;
}

/** Lo que se guarda en `busqueda`: también el número de socio. */
export function textoDeBusqueda(ficha: DatosDeAlumno, numeroDeSocio: number): string {
  const partes = [
    ficha.nombre,
    ficha.apellido,
    ficha.documento ?? "",
    digitos(ficha.telefono ?? ""),
    String(numeroDeSocio),
  ];
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
