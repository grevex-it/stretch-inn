// Reglas de un plan (abono) y de su precio por sede. Puro. Los montos son pesos enteros (0009).
import { falla, ok, pesos, type Dinero, type Resultado } from "@app/nucleo";

export type ErrorDePlan = "nombre-vacio" | "clases-invalidas" | "precio-invalido";

export interface DatosDePlan {
  nombre: string;
  clasesPorSemana: number;
  precio: Dinero;
}

/** Tope de un precio: evita un cero de más por error de tipeo. */
const PRECIO_MAXIMO = 100_000_000;

export function precioValido(precio: number): Resultado<Dinero, ErrorDePlan> {
  if (!Number.isSafeInteger(precio) || precio <= 0 || precio > PRECIO_MAXIMO) {
    return falla("precio-invalido", "Revisá el precio: tiene que ser en pesos, sin centavos.");
  }
  return ok(pesos(precio));
}

export function limpiarPlan(datos: {
  nombre: string;
  clasesPorSemana: number;
  precio: number;
}): Resultado<DatosDePlan, ErrorDePlan> {
  const nombre = datos.nombre.trim();
  if (nombre === "") return falla("nombre-vacio", "Poné el nombre del plan.");
  const { clasesPorSemana } = datos;
  if (!Number.isInteger(clasesPorSemana) || clasesPorSemana < 1 || clasesPorSemana > 7) {
    return falla("clases-invalidas", "Las clases por semana van de 1 a 7.");
  }
  const precio = precioValido(datos.precio);
  if (!precio.ok) return precio;
  return ok({ nombre, clasesPorSemana, precio: precio.valor });
}

/** La sede usa su precio si lo tiene; si no, el general del centro (0011). */
export function precioEnSede(general: Dinero, deLaSede: Dinero | undefined): Dinero {
  return deLaSede ?? general;
}
