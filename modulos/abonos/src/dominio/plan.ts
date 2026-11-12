// Reglas de un plan (abono) y de su precio por sede. Puro. Los montos son pesos enteros (0009).
// El plan es un paquete de clases (0020): 4 para el abono, 1 para la clase suelta o la de prueba.
import { falla, ok, pesos, type Dinero, type Resultado } from "@app/nucleo";

export type ErrorDePlan = "nombre-vacio" | "clases-invalidas" | "precio-invalido";

export interface DatosDePlan {
  nombre: string;
  /** Cuántas clases trae el paquete. */
  clases: number;
  precio: Dinero;
}

/** Tope de un precio: evita un cero de más por error de tipeo. */
const PRECIO_MAXIMO = 100_000_000;
/** Las clases de un paquete: hasta 100, lo que agenda devuelve de una vez. */
const CLASES_MAXIMAS = 100;

export function precioValido(precio: number): Resultado<Dinero, ErrorDePlan> {
  if (!Number.isSafeInteger(precio) || precio <= 0 || precio > PRECIO_MAXIMO) {
    return falla("precio-invalido", "Revisá el precio: tiene que ser en pesos, sin centavos.");
  }
  return ok(pesos(precio));
}

export function limpiarPlan(datos: {
  nombre: string;
  clases: number;
  precio: number;
}): Resultado<DatosDePlan, ErrorDePlan> {
  const nombre = datos.nombre.trim();
  if (nombre === "") return falla("nombre-vacio", "Poné el nombre del plan.");
  const { clases } = datos;
  if (!Number.isInteger(clases) || clases < 1 || clases > CLASES_MAXIMAS) {
    return falla("clases-invalidas", "El abono tiene entre 1 y 100 clases.");
  }
  const precio = precioValido(datos.precio);
  if (!precio.ok) return precio;
  return ok({ nombre, clases, precio: precio.valor });
}

/** La sede usa su precio si lo tiene; si no, el general del centro (0011). */
export function precioEnSede(general: Dinero, deLaSede: Dinero | undefined): Dinero {
  return deLaSede ?? general;
}
