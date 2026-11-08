// La ficha de una clase semanal: limpieza y validación. Puro: sin base ni reloj.
import { falla, ok, type Resultado } from "@app/nucleo";
import type { Horario } from "./ocurrencias.ts";

/** Una clase semanal de una sede, en la hora local del centro. */
export interface DatosDeClase extends Horario {
  /** Lo que se dicta: «Stretching», «Elongación avanzada». */
  nombre: string;
  /** Lugares por fecha. */
  cupo: number;
}

export type ErrorDeClase =
  "nombre-vacio" | "dia-invalido" | "hora-invalida" | "duracion-invalida" | "cupo-invalido";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DURACION = { minima: 15, maxima: 240 };
const CUPO_MAXIMO = 500;

const entreEnteros = (valor: number, minimo: number, maximo: number) =>
  Number.isInteger(valor) && valor >= minimo && valor <= maximo;

/** La clase con el nombre recortado, o la primera regla que no cumple. */
export function limpiarClase(datos: DatosDeClase): Resultado<DatosDeClase, ErrorDeClase> {
  const clase = { ...datos, nombre: datos.nombre.trim() };
  if (clase.nombre === "") return falla("nombre-vacio", "Escribí el nombre de la clase.");
  if (!entreEnteros(clase.dia, 1, 7)) return falla("dia-invalido", "Elegí el día de la semana.");
  if (!HORA.test(clase.hora)) return falla("hora-invalida", "Revisá la hora: tiene que ser HH:MM.");
  if (!entreEnteros(clase.duracionMinutos, DURACION.minima, DURACION.maxima)) {
    return falla("duracion-invalida", "La clase dura entre 15 minutos y 4 horas.");
  }
  if (!entreEnteros(clase.cupo, 1, CUPO_MAXIMO)) {
    return falla("cupo-invalido", "El cupo va de 1 a 500 lugares.");
  }
  return ok(clase);
}
