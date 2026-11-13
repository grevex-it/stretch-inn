// Las reglas de un gasto (0022). Puro: sin base ni reloj propio. Montos en pesos enteros (0009).
import { falla, ok, pesos, type Dinero, type Resultado } from "@app/nucleo";

export type ErrorDeGasto =
  | "fecha-invalida"
  | "monto-invalido"
  | "categoria-invalida"
  | "medio-invalido"
  | "descripcion-larga"
  | "clave-invalida"
  | "motivo-vacio";

/** **[SUPUESTO]** Las categorías de Stretch Inn. Otra se suma cuando un centro la pida (0011). */
export const CATEGORIAS = [
  "alquiler",
  "servicios",
  "sueldos",
  "insumos",
  "mantenimiento",
  "impuestos",
  "otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Los mismos medios que la caja (0019). */
export const MEDIOS_DE_GASTO = ["efectivo", "transferencia"] as const;
export type MedioDeGasto = (typeof MEDIOS_DE_GASTO)[number];

const MONTO_MAXIMO = 100_000_000;
const DESCRIPCION_MAXIMA = 500;
const UN_DIA = 86_400_000;

export interface DatosDeGasto {
  /** AAAA-MM-DD: el día del gasto, en la zona del centro. */
  fecha: string;
  monto: number;
  categoria: string;
  medio: string;
  descripcion: string;
  claveIdempotencia: string;
}

export interface GastoLimpio extends DatosDeGasto {
  monto: Dinero;
  categoria: Categoria;
  medio: MedioDeGasto;
}

const incluye = <T extends string>(lista: readonly T[], valor: string): valor is T =>
  (lista as readonly string[]).includes(valor);

/** Un día que existe y no es posterior a mañana (por la diferencia de zona con UTC). */
function fechaValida(fecha: string, hoy: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (!dia.toISOString().startsWith(fecha)) return false;
  return dia.getTime() <= hoy.getTime() + UN_DIA;
}

/** El gasto limpio, o la primera regla que no cumple. */
export function limpiarGasto(datos: DatosDeGasto, hoy: Date): Resultado<GastoLimpio, ErrorDeGasto> {
  const { fecha, monto, categoria, medio } = datos;
  if (!fechaValida(fecha, hoy)) return falla("fecha-invalida", "Revisá la fecha del gasto.");
  if (!Number.isInteger(monto) || monto < 1 || monto > MONTO_MAXIMO) {
    return falla("monto-invalido", "El monto va en pesos enteros, mayor que cero.");
  }
  if (!incluye(CATEGORIAS, categoria)) return falla("categoria-invalida", "Elegí la categoría.");
  if (!incluye(MEDIOS_DE_GASTO, medio)) return falla("medio-invalido", "Elegí el medio de pago.");
  const descripcion = datos.descripcion.trim();
  if (descripcion.length > DESCRIPCION_MAXIMA) {
    return falla("descripcion-larga", "La descripción es muy larga: hasta 500 caracteres.");
  }
  const clave = datos.claveIdempotencia.trim();
  if (clave.length < 8 || clave.length > 100) {
    return falla("clave-invalida", "Falta la clave del gasto: volvé a intentarlo.");
  }
  return ok({
    fecha,
    monto: pesos(monto),
    categoria,
    medio,
    descripcion,
    claveIdempotencia: clave,
  });
}

export function limpiarMotivo(motivo: string): Resultado<string, ErrorDeGasto> {
  const limpio = motivo.trim();
  if (limpio === "") return falla("motivo-vacio", "Contá por qué se anula el gasto.");
  return ok(limpio);
}
