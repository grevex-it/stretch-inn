// Leer la hoja «Alumnos» de la planilla que completa Stretch Inn hasta que arranque el sistema
// (0022). Convierte cada fila a lo que espera la ficha del alumno; no valida reglas de negocio:
// eso lo hace la API al cargarla.
import ExcelJS from "exceljs";
import { separarNombre } from "./nombres.ts";

/** Una fila de la planilla, lista para cargar. */
export interface FilaDeLaPlanilla {
  /** El número de fila en el Excel, para avisar problemas. */
  fila: number;
  numeroDeSocio: number;
  nombre: string;
  apellido: string;
  /** El nombre se separó con más de dos palabras: conviene revisarlo. */
  revisarNombre: boolean;
  documento: string | null;
  /** AAAA-MM-DD. */
  fechaNacimiento: string | null;
  telefono: string | null;
  /** El nombre del profe, como figura en la planilla. */
  profe: string | null;
  fechaDeInicio: string | null;
  activo: boolean;
  fechaDeBaja: string | null;
  /** Observaciones y antecedentes de salud: van a los datos de salud, no a la ficha. */
  salud: string | null;
}

export interface Problema {
  fila: number;
  mensaje: string;
}

/** Las columnas de la hoja «Alumnos», en orden (1 = A). */
const COLUMNA = {
  socio: 1,
  nombre: 2,
  dni: 3,
  nacimiento: 4,
  celular: 5,
  profe: 6,
  inicio: 7,
  estado: 11,
  baja: 12,
  salud: 13,
} as const;

function texto(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") return null;
  const limpio = String(valor).trim();
  return limpio === "" ? null : limpio;
}

/** Una fecha de Excel (Date) o escrita como DD/MM/AAAA, como AAAA-MM-DD. */
function fecha(valor: ExcelJS.CellValue): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const escrita = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto(valor) ?? "");
  if (escrita === null) return null;
  const [, dia = "", mes = "", anio = ""] = escrita;
  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function convertir(fila: ExcelJS.Row): FilaDeLaPlanilla | Problema | undefined {
  const celda = (columna: number) => fila.getCell(columna).value;
  const numero = Number(texto(celda(COLUMNA.socio)));
  const completo = texto(celda(COLUMNA.nombre));
  if (texto(celda(COLUMNA.socio)) === null && completo === null) return undefined;
  if (!Number.isInteger(numero) || numero < 1) {
    return { fila: fila.number, mensaje: "Falta el número de socio." };
  }
  if (completo === null) return { fila: fila.number, mensaje: "Falta el nombre y apellido." };
  const { nombre, apellido, revisar } = separarNombre(completo);
  return {
    fila: fila.number,
    numeroDeSocio: numero,
    nombre,
    apellido,
    revisarNombre: revisar,
    documento: texto(celda(COLUMNA.dni)),
    fechaNacimiento: fecha(celda(COLUMNA.nacimiento)),
    telefono: texto(celda(COLUMNA.celular)),
    profe: texto(celda(COLUMNA.profe)),
    fechaDeInicio: fecha(celda(COLUMNA.inicio)),
    activo: texto(celda(COLUMNA.estado))?.toLowerCase() !== "inactivo",
    fechaDeBaja: fecha(celda(COLUMNA.baja)),
    salud: texto(celda(COLUMNA.salud)),
  };
}

/** Las filas de la hoja «Alumnos» (desde la segunda) y los problemas de las que no se pueden leer. */
export async function leerPlanilla(
  archivo: Buffer,
): Promise<{ filas: FilaDeLaPlanilla[]; problemas: Problema[] }> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  const hoja = libro.getWorksheet("Alumnos");
  if (hoja === undefined) throw new Error("La planilla no tiene la hoja «Alumnos».");
  const filas: FilaDeLaPlanilla[] = [];
  const problemas: Problema[] = [];
  hoja.eachRow((fila) => {
    if (fila.number === 1) return;
    const leida = convertir(fila);
    if (leida === undefined) return;
    if ("mensaje" in leida) problemas.push(leida);
    else filas.push(leida);
  });
  return { filas, problemas };
}
