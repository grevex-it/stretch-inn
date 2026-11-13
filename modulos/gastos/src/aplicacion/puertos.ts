// Lo que los gastos necesitan de afuera (ver docs/decisiones/0003): la base.
import type { ContextoCentro, Dinero, Resultado } from "@app/nucleo";
import type { Categoria, ErrorDeGasto, MedioDeGasto } from "../dominio/gasto.ts";

interface Pagina {
  pagina: number;
  porPagina: number;
}

interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

/** Un gasto de una sede. Anularlo no lo borra. */
export interface Gasto {
  id: string;
  sedeId: string;
  /** AAAA-MM-DD, en la zona del centro. */
  fecha: string;
  monto: Dinero;
  categoria: Categoria;
  medio: MedioDeGasto;
  descripcion: string;
  registradoEn: Date;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
}

/** Quien registra: un usuario del centro o soporte (0008). */
export interface Registro {
  tipo: "usuario" | "soporte";
  id: string;
  en: Date;
}

type GastoNuevo = Omit<Gasto, "id" | "registradoEn" | "anuladoEn" | "motivoAnulacion">;

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioGastos {
  /** El gasto de esa clave, si ya se cargó. */
  gastoPorClave(clave: string): Promise<Gasto | undefined>;
  /** El id del gasto nuevo, o undefined si la clave ya se usó (otro pedido ganó la carrera). */
  cargar(gasto: GastoNuevo & { clave: string }, registro: Registro): Promise<string | undefined>;
  /** El gasto, tomado hasta el fin de la transacción. */
  gasto(id: string): Promise<Gasto | undefined>;
  anular(id: string, motivo: string, registro: Registro): Promise<void>;
  delPeriodo(
    filtro: Pagina & { sedeId: string; desde: string; hasta: string },
  ): Promise<PaginaDe<Gasto> & { gastado: Dinero }>;
}

export type ErrorDeGastos =
  | ErrorDeGasto
  | "sin-permiso"
  | "clave-usada"
  | "gasto-inexistente"
  | "gasto-anulado"
  | "periodo-invalido";

export type PedidoDeGasto = {
  sedeId: string;
  fecha: string;
  monto: number;
  categoria: string;
  medio: string;
  descripcion: string;
  claveIdempotencia: string;
};

export interface Gastos {
  /** El mismo pedido con la misma clave no carga dos veces. */
  cargar(
    quien: ContextoCentro,
    gasto: PedidoDeGasto,
  ): Promise<Resultado<{ id: string; repetido: boolean }, ErrorDeGastos>>;
  /** Con motivo. No lo borra. */
  anular(
    quien: ContextoCentro,
    anulacion: { id: string; motivo: string },
  ): Promise<Resultado<null, ErrorDeGastos>>;
  /** Los gastos de una sede entre dos días (inclusive), el más nuevo primero, y lo gastado. */
  delPeriodo(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string; desde: string; hasta: string },
  ): Promise<Resultado<PaginaDe<Gasto> & { gastado: Dinero }, ErrorDeGastos>>;
}
