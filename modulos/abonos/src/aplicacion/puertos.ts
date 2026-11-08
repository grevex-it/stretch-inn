// Lo que los abonos necesitan de afuera (ver docs/decisiones/0003): la base, personas y centros.
import type { ContextoCentro, Dinero, Resultado } from "@app/nucleo";
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

/** La cuota de un alumno en un mes. El monto se congela al generarla. */
export interface Cuota {
  id: string;
  alumnoId: string;
  planId: string;
  sedeId: string;
  /** AAAA-MM. */
  periodo: string;
  monto: Dinero;
  pagadaEn: Date | null;
}

/** Una cuota sin pagar, con el alumno (null si personas no lo devuelve). */
interface CuotaImpaga extends Omit<Cuota, "pagadaEn"> {
  alumno: { nombre: string; apellido: string; activo: boolean } | null;
}

/** Una página de impagas y lo que suman todas (no solo la página). */
export interface PaginaDeImpagas extends PaginaDe<CuotaImpaga> {
  adeudado: Dinero;
}

/** Una cuota del mes anterior que se renueva, con el plan y su precio de hoy en la sede. */
export interface CuotaARenovar {
  alumnoId: string;
  planId: string;
  planActivo: boolean;
  precio: Dinero;
  precioDeSede: Dinero | undefined;
}

/** Lo que pasó al generar las cuotas del mes de una sede. */
export interface CuotasDelMes {
  periodo: string;
  generadas: number;
  /** Alumnos que ya tenían la cuota de ese mes. */
  yaTenian: number;
  alumnosDeBaja: number;
  planesDeBaja: number;
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
  /** El id de la cuota nueva, o undefined si ya tenía una vigente en ese mes. */
  generarCuota(cuota: Omit<Cuota, "id" | "pagadaEn">): Promise<string | undefined>;
  /** La cuota vigente (sin anular), tomada hasta el fin de la transacción si `bloquear`. */
  cuota(id: string, bloquear?: boolean): Promise<Cuota | undefined>;
  anularCuota(id: string, ahora: Date): Promise<void>;
  marcarPagada(id: string, pagoId: string, en: Date): Promise<void>;
  cuotasDeAlumno(
    filtro: Pagina & { alumnoId: string; sedeIds: readonly string[] },
  ): Promise<PaginaDe<Cuota>>;
  /** Sin pagar ni anular, la más vieja primero, con el total adeudado. */
  cuotasImpagas(
    filtro: Pagina & { sedeId: string; periodo?: string },
  ): Promise<PaginaDe<Cuota> & { adeudado: Dinero }>;
  /** Hasta 100 alumnos del centro (personas), por id. */
  alumnos(ids: readonly string[]): Promise<Map<string, NonNullable<CuotaImpaga["alumno"]>>>;
  /** Una tanda de cuotas vigentes de ese mes y sede, por alumno, después de `despuesDe`. */
  cuotasARenovar(filtro: {
    sedeId: string;
    periodo: string;
    despuesDe: string | undefined;
    limite: number;
  }): Promise<CuotaARenovar[]>;
  /** Cuántas se generaron: las de alumnos que ya tenían cuota ese mes no se tocan. */
  generarCuotas(cuotas: readonly Omit<Cuota, "id" | "pagadaEn">[]): Promise<number>;
}

export type ErrorDeAbonos =
  | ErrorDePlan
  | "sin-permiso"
  | "plan-inexistente"
  | "plan-inactivo"
  | "cambio-concurrente"
  | "alumno-inexistente"
  | "alumno-de-baja"
  | "periodo-invalido"
  | "ya-tiene-cuota"
  | "cuota-inexistente"
  | "cuota-pagada";

export type NuevoPlan = { nombre: string; clasesPorSemana: number; precio: number };

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
  /** La cuota del alumno en ese mes (por defecto, el actual), con el precio de la sede. */
  generarCuota(
    quien: ContextoCentro,
    pedido: { alumnoId: string; planId: string; sedeId: string; periodo?: string },
  ): Promise<Resultado<{ id: string; monto: Dinero; periodo: string }, ErrorDeAbonos>>;
  /** Solo una cuota sin pagar. No la borra. */
  anularCuota(
    quien: ContextoCentro,
    cuota: { id: string },
  ): Promise<Resultado<null, ErrorDeAbonos>>;
  cuotasDeAlumno(
    quien: ContextoCentro,
    filtro: Pagina & { alumnoId: string },
  ): Promise<Resultado<PaginaDe<Cuota>, ErrorDeAbonos>>;
  /** Las impagas de la sede (de un mes, si se pide), la más vieja primero. */
  cuotasImpagas(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string; periodo?: string },
  ): Promise<Resultado<PaginaDeImpagas, ErrorDeAbonos>>;
  /** [SUPUESTO] Renueva las cuotas del mes anterior de la sede. Sin período, el mes actual. */
  generarCuotasDelMes(
    quien: ContextoCentro,
    pedido: { sedeId: string; periodo?: string },
  ): Promise<Resultado<CuotasDelMes, ErrorDeAbonos>>;
}
