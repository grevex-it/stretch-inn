// Lo que la caja necesita de afuera (ver docs/decisiones/0003): la base, abonos y centros.
import type { ContextoCentro, Dinero, Resultado } from "@app/nucleo";
import type { ErrorDeCobro, Medio } from "../dominio/cobro.ts";
import type { PagoRegistrado } from "../dominio/eventos.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

/** Un pago registrado en caja. Anularlo no lo borra. */
export interface Pago {
  id: string;
  sedeId: string;
  alumnoId: string;
  cuotaId: string;
  monto: Dinero;
  medio: Medio;
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

/** La cuota a cobrar, leída de abonos. */
interface CuotaACobrar {
  id: string;
  alumnoId: string;
  sedeId: string;
  monto: Dinero;
  pagadaEn: Date | null;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioCaja {
  /** Si el trabajo devuelve una falla, se deshace lo que escribió (punto de guardado). */
  todoONada<R extends { ok: boolean }>(trabajo: () => Promise<R>): Promise<R>;
  zonaHoraria(): Promise<string>;
  /** Por la API pública de abonos. */
  cuota(id: string): Promise<CuotaACobrar | undefined>;
  /** Marca la cuota pagada en abonos, en esta misma transacción. */
  registrarPagoDeCuota(pago: { cuotaId: string; pagoId: string; en: Date }): Promise<boolean>;
  revertirPagoDeCuota(pago: { cuotaId: string; pagoId: string }): Promise<void>;
  /** Encola el evento en esta transacción (outbox): si no confirma, el evento tampoco queda. */
  publicarPagoRegistrado(evento: PagoRegistrado): Promise<void>;
  /** El pago de esa clave, si ya se registró (o se está registrando en otra transacción). */
  pagoPorClave(clave: string): Promise<Pago | undefined>;
  /** El id del pago nuevo, o undefined si la clave ya se usó. */
  registrar(
    pago: Omit<Pago, "id" | "registradoEn" | "anuladoEn" | "motivoAnulacion"> & { clave: string },
    registro: Registro,
  ): Promise<string | undefined>;
  /** El pago, tomado hasta el fin de la transacción. */
  pago(id: string): Promise<Pago | undefined>;
  anular(id: string, motivo: string, registro: Registro): Promise<void>;
  delDia(
    filtro: Pagina & { sedeId: string; desde: Date; hasta: Date },
  ): Promise<PaginaDe<Pago> & { cobrado: Dinero }>;
}

export type ErrorDeCaja =
  | ErrorDeCobro
  | "sin-permiso"
  | "cuota-inexistente"
  | "cuota-pagada"
  | "clave-usada"
  | "pago-inexistente"
  | "pago-anulado"
  | "dia-invalido";

export interface Caja {
  /** Cobra la cuota completa. El mismo pedido con la misma clave no cobra dos veces. */
  cobrarCuota(
    quien: ContextoCentro,
    cobro: { cuotaId: string; medio: string; claveIdempotencia: string },
  ): Promise<Resultado<{ id: string; monto: Dinero; repetido: boolean }, ErrorDeCaja>>;
  /** Anula el pago con un motivo; la cuota vuelve a estar sin pagar. No lo borra. */
  anular(
    quien: ContextoCentro,
    anulacion: { id: string; motivo: string },
  ): Promise<Resultado<null, ErrorDeCaja>>;
  /** Los pagos de un día en una sede y lo cobrado (sin los anulados). */
  delDia(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string; dia: string },
  ): Promise<Resultado<PaginaDe<Pago> & { cobrado: Dinero }, ErrorDeCaja>>;
}
