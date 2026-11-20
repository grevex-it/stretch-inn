// Lo que el módulo de profesores necesita de afuera (ver docs/decisiones/0003): la base, identidad
// (el profe es un usuario del equipo) y centros (el día de hoy en la zona del centro).
import type { ContextoCentro, Dinero, Resultado } from "@app/nucleo";
import type { TipoDeProfe } from "../dominio/profe.ts";
import type { ErrorDeTarifa, Tarifa } from "../dominio/tarifas.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

export interface Profe {
  id: string;
  nombre: string;
  tipo: TipoDeProfe;
}

export interface TarifaGuardada extends Tarifa {
  id: string;
  monto: Dinero;
}

/** El alcance de una tarifa: qué profe (o todos) y qué sede (o todas). */
export interface Alcance {
  sedeId: string | null;
  profeId: string | null;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioProfesores {
  /** El día de hoy en la zona del centro, AAAA-MM-DD. */
  hoy(ahora: Date): Promise<string>;
  /** Una página del equipo activo del centro (identidad), por nombre. */
  equipo(pagina: Pagina): Promise<PaginaDe<{ id: string; nombre: string }>>;
  /** Si es un usuario activo del centro (identidad). */
  profeValido(id: string): Promise<boolean>;
  tipos(profeIds: readonly string[]): Promise<Map<string, TipoDeProfe>>;
  guardarTipo(profeId: string, tipo: TipoDeProfe): Promise<void>;
  /** Los cambios de tarifas de un alcance van de a uno hasta el fin de la transacción. */
  bloquearAlcance(alcance: Alcance): Promise<void>;
  /** La tarifa del alcance que empieza más tarde y sigue abierta, o undefined. */
  ultimaAbierta(alcance: Alcance): Promise<TarifaGuardada | undefined>;
  cerrar(alcance: Alcance, id: string, hasta: string): Promise<void>;
  guardarTarifa(alcance: Alcance, tarifa: { monto: Dinero; desde: string }): Promise<void>;
  /** Las de todo el centro (sedeId null) o las de una sede, la más nueva primero. */
  tarifas(filtro: Pagina & { sedeId: string | null }): Promise<PaginaDe<TarifaGuardada>>;
}

export type ErrorDeProfesores = ErrorDeTarifa | "sin-permiso" | "profe-invalido" | "tipo-invalido";

export interface Profesores {
  /** El equipo activo del centro con el tipo de cada uno. */
  profes(
    quien: ContextoCentro,
    pagina: Pagina,
  ): Promise<Resultado<PaginaDe<Profe>, ErrorDeProfesores>>;
  fijarTipo(
    quien: ContextoCentro,
    cambio: { profeId: string; tipo: string },
  ): Promise<Resultado<null, ErrorDeProfesores>>;
  /** Las de todo el centro (sedeId null) o las de una sede, la más nueva primero. */
  tarifas(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string | null },
  ): Promise<Resultado<PaginaDe<TarifaGuardada>, ErrorDeProfesores>>;
  /** Una tarifa nueva del alcance: rige desde `desde` y cierra la anterior el día antes. */
  fijarTarifa(
    quien: ContextoCentro,
    tarifa: Alcance & { monto: number; desde: string },
  ): Promise<Resultado<null, ErrorDeProfesores>>;
}
