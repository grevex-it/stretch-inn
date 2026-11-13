// Cargar las filas de la planilla por la API (0022): sin duplicar (por número de socio), con el
// profe por nombre, los datos de salud aparte y la baja de los inactivos. Con una API falsa.
import { describe, expect, it } from "vitest";
import { cargarFilas, type ApiDeCarga } from "../../src/importacion/cargar.ts";
import type { FilaDeLaPlanilla } from "../../src/importacion/planilla.ts";

const FILA: FilaDeLaPlanilla = {
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
};

function apiFalsa(existentes: number[] = [], rechazar: number[] = []) {
  const hecho: string[] = [];
  const api: ApiDeCarga = {
    profes: () => Promise.resolve(new Map([["lorena alejandra sosa", "id-lore"]])),
    existe: (numero) => Promise.resolve(existentes.includes(numero)),
    crear: (ficha) => {
      if (rechazar.includes(ficha.numeroDeSocio)) {
        return Promise.resolve({ ok: false as const, mensaje: "Revisá la fecha de nacimiento." });
      }
      hecho.push(`crear ${String(ficha.numeroDeSocio)} profe=${String(ficha.profeId)}`);
      return Promise.resolve({ ok: true as const, id: `alumno-${String(ficha.numeroDeSocio)}` });
    },
    guardarSalud: (id, patologias) => {
      hecho.push(`salud ${id} ${patologias}`);
      return Promise.resolve();
    },
    darDeBaja: (id) => {
      hecho.push(`baja ${id}`);
      return Promise.resolve();
    },
  };
  return { api, hecho };
}

describe("cargarFilas", () => {
  it("crea el alumno con su profe, le carga la salud y da de baja a los inactivos", async () => {
    const { api, hecho } = apiFalsa();
    const inactiva = { ...FILA, fila: 3, numeroDeSocio: 65, salud: null, activo: false };

    const informe = await cargarFilas([FILA, inactiva], api);

    expect(hecho).toEqual([
      "crear 54 profe=id-lore",
      "salud alumno-54 Dolor lumbar",
      "crear 65 profe=id-lore",
      "baja alumno-65",
    ]);
    expect(informe).toEqual({ creados: 2, yaEstaban: 0, errores: [], profesSinUsuario: [] });
  });

  it("no duplica: saltea los números de socio que ya están", async () => {
    const { api, hecho } = apiFalsa([54]);

    const informe = await cargarFilas([FILA], api);

    expect(hecho).toEqual([]);
    expect(informe).toMatchObject({ creados: 0, yaEstaban: 1 });
  });

  it("un profe sin usuario queda sin profe y se avisa; un rechazo de la API se informa", async () => {
    const { api, hecho } = apiFalsa([], [65]);
    const otraProfe = { ...FILA, numeroDeSocio: 54, profe: "REBECA JULIA ESPÍNDOLA", salud: null };
    const rechazada = { ...FILA, fila: 9, numeroDeSocio: 65 };

    const informe = await cargarFilas([otraProfe, rechazada], api);

    expect(hecho).toEqual(["crear 54 profe=null"]);
    expect(informe).toEqual({
      creados: 1,
      yaEstaban: 0,
      errores: [{ fila: 9, mensaje: "Revisá la fecha de nacimiento." }],
      profesSinUsuario: ["REBECA JULIA ESPÍNDOLA"],
    });
  });
});
