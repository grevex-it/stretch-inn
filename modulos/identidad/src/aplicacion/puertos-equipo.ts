// Lo que la gestión del equipo necesita de afuera (ver docs/decisiones/0003 y 0017).
import type { ContextoCentro, Permiso, Resultado } from "@app/nucleo";
import type { ErrorDeAlta, ErrorDeGestion } from "../dominio/equipo.ts";
import type { FilaDePermiso } from "./puertos.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface Integrante {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  /** Solo las de las sedes que ve quien consulta. */
  asignaciones: { sedeId: string; rolId: string; rol: string }[];
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

interface RolDelCentro {
  id: string;
  nombre: string;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioEquipo {
  usuarios(pagina: Pagina): Promise<PaginaDe<Omit<Integrante, "email" | "asignaciones">>>;
  asignacionesDe(
    usuarioIds: readonly string[],
  ): Promise<{ usuarioId: string; sedeId: string; rolId: string; rol: string }[]>;
  /** Función de alcance mínimo: solo emails de usuarios del centro del contexto. */
  emailsDe(usuarioIds: readonly string[]): Promise<Map<string, string>>;
  roles(pagina: Pagina): Promise<PaginaDe<RolDelCentro>>;
  /** Los permisos del rol, o undefined si no existe en el centro. */
  permisosDeRol(rolId: string): Promise<Permiso[] | undefined>;
  /** Función de alcance mínimo: la cuenta de ese email, o una nueva con esa clave. */
  cuentaParaAlta(email: string, hashClave: string): Promise<{ cuentaId: string; nueva: boolean }>;
  /** Devuelve undefined si la cuenta ya es usuario del centro. */
  crearUsuario(usuario: { cuentaId: string; nombre: string }): Promise<string | undefined>;
  asignar(usuarioId: string, sedeIds: readonly string[], rolId: string): Promise<void>;
  /** El usuario del centro, o undefined si no existe. */
  usuario(usuarioId: string): Promise<{ cuentaId: string; activo: boolean } | undefined>;
  /** Función de alcance mínimo: en todas sus sedes, esté activo o no. */
  permisosDeUsuario(usuarioId: string): Promise<FilaDePermiso[]>;
  /** Función de alcance mínimo (0017). */
  resetearClave(
    usuarioId: string,
    hashClave: string,
  ): Promise<"ok" | "inexistente" | "otros-centros">;
  fijarActivo(usuarioId: string, activo: boolean): Promise<void>;
  revocarSesionesDeCuenta(cuentaId: string, ahora: Date): Promise<void>;
  revocarSesionesDeUsuario(usuarioId: string, ahora: Date): Promise<void>;
}

export type ErrorDeEquipo =
  | ErrorDeAlta
  | ErrorDeGestion
  | "rol-inexistente"
  | "permisos-ajenos"
  | "ya-es-del-equipo"
  | "usuario-inexistente"
  | "otros-centros";

export interface DatosDeAlta {
  nombre: string;
  email: string;
  rolId: string;
  sedeIds: readonly string[];
}

export interface Equipo {
  listar(quien: ContextoCentro, pagina: Pagina): Promise<PaginaDe<Integrante>>;
  roles(quien: ContextoCentro, pagina: Pagina): Promise<PaginaDe<RolDelCentro>>;
  /** La clave temporal solo si la cuenta es nueva; si ya existía, entra con la suya. */
  darDeAlta(
    quien: ContextoCentro,
    datos: DatosDeAlta,
  ): Promise<Resultado<{ usuarioId: string; claveTemporal: string | null }, ErrorDeEquipo>>;
  resetearClave(
    quien: ContextoCentro,
    usuarioId: string,
  ): Promise<Resultado<{ claveTemporal: string }, ErrorDeEquipo>>;
  bloquear(quien: ContextoCentro, usuarioId: string): Promise<Resultado<null, ErrorDeEquipo>>;
  reactivar(quien: ContextoCentro, usuarioId: string): Promise<Resultado<null, ErrorDeEquipo>>;
}
