// Lo que los abonos necesitan de afuera (ver docs/decisiones/0003): la base, personas y centros.
import type { ContextoCentro, Dinero, Resultado } from "@app/nucleo";
import type { EstadoDelAbono } from "../dominio/estado.ts";
import type { DatosDePlan, ErrorDePlan } from "../dominio/plan.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

/** Un plan del centro, con los precios propios de las sedes que se ven. */
export interface Plan extends DatosDePlan {
  id: string;
  activo: boolean;
  version: number;
  preciosDeSede: { sedeId: string; precio: Dinero }[];
}

/**
 * La cuota de un paquete de clases de un alumno (0020). El monto y las clases se congelan al
 * generarla. Cada fecha del horario fijo desde `desde` gasta una clase.
 */
export interface Cuota {
  id: string;
  alumnoId: string;
  planId: string;
  sedeId: string;
  /** Desde qué día cuenta, AAAA-MM-DD en la zona del centro. */
  desde: string;
  /** Cuántas clases trae. */
  clases: number;
  monto: Dinero;
  pagadaEn: Date | null;
  /** El pago de caja que la saldó: con ese id se anula desde la ficha (0019). */
  pagoId: string | null;
}

/** El abono actual de un alumno en una sede (0020): cada fecha que terminó gastó una clase. */
export interface AbonoDelAlumno extends EstadoDelAbono {
  cuotaId: string;
  desde: string;
  clases: number;
  pagada: boolean;
}

/** Una cuota sin pagar, con el alumno (null si personas no lo devuelve). */
interface CuotaImpaga extends Omit<Cuota, "pagadaEn" | "pagoId"> {
  alumno: { nombre: string; apellido: string; activo: boolean } | null;
}

/** Una página de impagas y lo que suman todas (no solo la página). */
export interface PaginaDeImpagas extends PaginaDe<CuotaImpaga> {
  adeudado: Dinero;
}

/** Una fecha del horario fijo del alumno (de agenda): gasta una clase del abono. */
interface FechaDeClase {
  /** AAAA-MM-DD en la zona del centro. */
  fecha: string;
  terminaEn: Date;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioAbonos {
  zonaHoraria(): Promise<string>;
  planes(filtro: Pagina): Promise<PaginaDe<Omit<Plan, "preciosDeSede">>>;
  /** Los precios propios de esos planes en las sedes visibles. */
  preciosDeSede(planIds: readonly string[]): Promise<Map<string, Plan["preciosDeSede"]>>;
  plan(id: string): Promise<Omit<Plan, "preciosDeSede"> | undefined>;
  crearPlan(datos: DatosDePlan): Promise<{ id: string }>;
  /** La versión nueva, o undefined si el plan cambió en el medio. */
  actualizarPlan(id: string, version: number, datos: DatosDePlan): Promise<number | undefined>;
  fijarActivo(id: string, activo: boolean): Promise<void>;
  /** Con `null`, la sede vuelve al precio general. */
  fijarPrecioDeSede(planId: string, sedeId: string, precio: Dinero | null): Promise<void>;
  precioDeSede(planId: string, sedeId: string): Promise<Dinero | undefined>;
  /** El alumno del centro (por la API pública de personas), o undefined. */
  alumno(id: string): Promise<{ activo: boolean } | undefined>;
  /** Las cuotas del alumno van de a una hasta el fin de la transacción: no se pisan. */
  bloquearAlumno(alumnoId: string): Promise<void>;
  /** Su cuota vigente (sin anular) que empieza más tarde, en cualquier sede. */
  ultimaCuota(alumnoId: string): Promise<Cuota | undefined>;
  /** Las primeras `cantidad` fechas de su horario fijo en la sede desde `desde` (agenda). */
  fechasDeAlumno(pedido: {
    alumnoId: string;
    sedeId: string;
    desde: string;
    cantidad: number;
  }): Promise<FechaDeClase[]>;
  /** Su cuota vigente en la sede que empezó más tarde hasta `hoy` (AAAA-MM-DD), o undefined. */
  cuotaEmpezada(pedido: {
    alumnoId: string;
    sedeId: string;
    hoy: string;
  }): Promise<Cuota | undefined>;
  /** El id de la cuota nueva, o undefined si ya tenía una vigente desde ese día. */
  generarCuota(cuota: Omit<Cuota, "id" | "pagadaEn" | "pagoId">): Promise<string | undefined>;
  /** La cuota vigente (sin anular), tomada hasta el fin de la transacción si `bloquear`. */
  cuota(id: string, bloquear?: boolean): Promise<Cuota | undefined>;
  anularCuota(id: string, ahora: Date): Promise<void>;
  marcarPagada(id: string, pagoId: string, en: Date): Promise<void>;
  cuotasDeAlumno(
    filtro: Pagina & { alumnoId: string; sedeIds: readonly string[] },
  ): Promise<PaginaDe<Cuota>>;
  /** Sin pagar ni anular, la más vieja primero, con el total adeudado. */
  cuotasImpagas(
    filtro: Pagina & { sedeId: string },
  ): Promise<PaginaDe<Cuota> & { adeudado: Dinero }>;
  /** Hasta 100 alumnos del centro (personas), por id. */
  alumnos(ids: readonly string[]): Promise<Map<string, NonNullable<CuotaImpaga["alumno"]>>>;
}

export type ErrorDeAbonos =
  | ErrorDePlan
  | "sin-permiso"
  | "plan-inexistente"
  | "plan-inactivo"
  | "cambio-concurrente"
  | "alumno-inexistente"
  | "alumno-de-baja"
  | "dia-invalido"
  | "ya-tiene-cuota"
  | "cuota-inexistente"
  | "cuota-pagada";

export type NuevoPlan = { nombre: string; clases: number; precio: number };

export interface Abonos {
  planes(quien: ContextoCentro, filtro: Pagina): Promise<Resultado<PaginaDe<Plan>, ErrorDeAbonos>>;
  crearPlan(
    quien: ContextoCentro,
    plan: NuevoPlan,
  ): Promise<Resultado<{ id: string }, ErrorDeAbonos>>;
  editarPlan(
    quien: ContextoCentro,
    plan: NuevoPlan & { id: string; version: number },
  ): Promise<Resultado<{ version: number }, ErrorDeAbonos>>;
  fijarActivo(
    quien: ContextoCentro,
    cambio: { id: string; activo: boolean },
  ): Promise<Resultado<null, ErrorDeAbonos>>;
  /** Con `precio: null`, la sede vuelve al precio general. */
  fijarPrecioDeSede(
    quien: ContextoCentro,
    cambio: { planId: string; sedeId: string; precio: number | null },
  ): Promise<Resultado<null, ErrorDeAbonos>>;
  /**
   * La cuota de un paquete de las clases del plan, con el precio de la sede, desde `desde`. Sin
   * `desde`, empieza el día después de la última clase de su abono anterior o, si no tiene, hoy
   * en el centro. No puede empezar antes de que termine su abono anterior (0020).
   */
  generarCuota(
    quien: ContextoCentro,
    pedido: { alumnoId: string; planId: string; sedeId: string; desde?: string },
  ): Promise<
    Resultado<{ id: string; monto: Dinero; desde: string; clases: number }, ErrorDeAbonos>
  >;
  /** Solo una cuota sin pagar. No la borra. */
  anularCuota(
    quien: ContextoCentro,
    cuota: { id: string },
  ): Promise<Resultado<null, ErrorDeAbonos>>;
  cuotasDeAlumno(
    quien: ContextoCentro,
    filtro: Pagina & { alumnoId: string },
  ): Promise<Resultado<PaginaDe<Cuota>, ErrorDeAbonos>>;
  /** El abono que empezó más tarde en la sede, con las clases que le quedan; null si no hay. */
  abonoDelAlumno(
    quien: ContextoCentro,
    pedido: { alumnoId: string; sedeId: string },
  ): Promise<Resultado<AbonoDelAlumno | null, ErrorDeAbonos>>;
  /** Las impagas de la sede, la más vieja primero. */
  cuotasImpagas(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string },
  ): Promise<Resultado<PaginaDeImpagas, ErrorDeAbonos>>;
}
