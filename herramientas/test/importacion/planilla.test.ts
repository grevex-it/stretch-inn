// Leer la hoja «Alumnos» de la planilla de Stretch Inn (0022): las columnas tal cual las completan,
// convertidas a lo que espera la ficha del alumno. Sin base.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { leerPlanilla } from "../../src/importacion/planilla.ts";

const COLUMNAS = [
  "Nº socio",
  "Nombre y apellido",
  "DNI",
  "Fecha de nacimiento",
  "Celular",
  "Profe",
  "Fecha de inicio",
  "Modalidad de pago",
  "Horario fijo: día (opcional)",
  "Horario fijo: hora (opcional)",
  "Estado",
  "Fecha de baja",
  "Observaciones / antecedentes de salud",
];

async function planilla(filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.addWorksheet("Cómo usar");
  const hoja = libro.addWorksheet("Alumnos");
  hoja.addRow(COLUMNAS);
  for (const fila of filas) hoja.addRow(fila);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const ADRIANA = [
  54,
  "ADRIANA ROLDÁN",
  20111222,
  new Date(Date.UTC(1970, 0, 15)),
  "54-351-5550000",
  "LORENA ALEJANDRA SOSA",
  null,
  null,
  null,
  null,
  "Activo",
  null,
  "Dolor lumbar",
];

describe("leerPlanilla", () => {
  it("convierte cada fila en una ficha: nombre separado, fechas AAAA-MM-DD y salud aparte", async () => {
    const { filas, problemas } = await leerPlanilla(await planilla([ADRIANA]));

    expect(problemas).toEqual([]);
    expect(filas).toEqual([
      {
        fila: 2,
        numeroDeSocio: 54,
        nombre: "Adriana",
        apellido: "Roldán",
        revisarNombre: false,
        documento: "20111222",
        fechaNacimiento: "1970-01-15",
        telefono: "54-351-5550000",
        profe: "LORENA ALEJANDRA SOSA",
        fechaDeInicio: null,
        activo: true,
        fechaDeBaja: null,
        salud: "Dolor lumbar",
      },
    ]);
  });

  it("lo que falta queda en null; las fechas escritas como texto también se leen", async () => {
    const sinDatos = [187, "BEA MOLINA", null, null, null, null, "25/10/2026", null, null, null];
    const deBaja = [...ADRIANA];
    deBaja.splice(0, 1, 212);
    deBaja.splice(10, 2, "Inactivo", new Date(Date.UTC(2026, 9, 1)));

    const { filas } = await leerPlanilla(await planilla([sinDatos, deBaja]));

    expect(filas[0]).toMatchObject({
      numeroDeSocio: 187,
      documento: null,
      fechaNacimiento: null,
      telefono: null,
      profe: null,
      fechaDeInicio: "2026-10-25",
      activo: true,
      salud: null,
    });
    expect(filas[1]).toMatchObject({ activo: false, fechaDeBaja: "2026-10-01" });
  });

  it("saltea las filas vacías y avisa las que no tienen número de socio o nombre", async () => {
    const { filas, problemas } = await leerPlanilla(
      await planilla([ADRIANA, [], [null, "SIN NUMERO"], [283, ""]]),
    );

    expect(filas).toHaveLength(1);
    expect(problemas).toEqual([
      { fila: 4, mensaje: "Falta el número de socio." },
      { fila: 5, mensaje: "Falta el nombre y apellido." },
    ]);
  });

  it("sin la hoja «Alumnos», falla", async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Otra");
    const archivo = Buffer.from(await libro.xlsx.writeBuffer());

    await expect(leerPlanilla(archivo)).rejects.toThrow("Alumnos");
  });
});
