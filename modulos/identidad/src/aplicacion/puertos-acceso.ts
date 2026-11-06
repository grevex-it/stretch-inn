// Lo que el login y las sesiones necesitan de afuera (ver docs/decisiones/0003 y 0017).
import type { ContextoCentro, Resultado } from "@app/nucleo";
import type { CentroDelPedido, SesionDelPedido } from "@app/plataforma";
import type { SedeActiva } from "../dominio/sesion.ts";
import type { FilaDePermiso } from "./puertos.ts";

export interface CuentaGuardada {
  id: string;
  hashClave: string;
  debeCambiarClave: boolean;
}

export interface SesionGuardada {
  id: string;
  cuentaId: string;
  centroId: string | null;
  usuarioId: string | null;
  /** null es «Todas mis sedes». */
  sedeActivaId: string | null;
  creadaEn: Date;
  ultimoUsoEn: Date;
  debeCambiarClave: boolean;
}

/** Un centro donde la cuenta tiene un usuario activo. */
export interface CentroDeCuenta {
  centroId: string;
  nombre: string;
  usuarioId: string;
  ultimaSedeId: string | null;
}

/** Datos de la plataforma (esquema plataforma) y funciones de alcance mínimo (0017). */
export interface RepositorioAcceso {
  cuentaPorEmail(email: string): Promise<CuentaGuardada | undefined>;
  cuentaPorId(cuentaId: string): Promise<CuentaGuardada | undefined>;
  cambiarClave(cuentaId: string, hashClave: string): Promise<void>;
  centrosDe(cuentaId: string): Promise<CentroDeCuenta[]>;
  /** Id y nombre de esas sedes del centro, si la cuenta es un usuario activo de él. */
  nombresDeSedes(
    cuentaId: string,
    centroId: string,
    sedeIds: readonly string[],
  ): Promise<{ id: string; nombre: string }[]>;
  permisosDe(cuentaId: string, centroId: string): Promise<FilaDePermiso[]>;
  crearSesion(sesion: { hashToken: string; cuentaId: string; ahora: Date }): Promise<string>;
  /** La sesión no revocada con ese hash de token, con datos de su cuenta. */
  sesionPorToken(hashToken: string): Promise<SesionGuardada | undefined>;
  marcarUso(sesionId: string, ahora: Date): Promise<void>;
  fijarCentro(
    sesionId: string,
    centro: { centroId: string; usuarioId: string; sedeActivaId: string | null },
  ): Promise<void>;
  fijarSede(sesionId: string, sedeActivaId: string | null): Promise<void>;
  revocar(sesionId: string, ahora: Date): Promise<void>;
  /** Revoca todas las sesiones de la cuenta salvo la indicada. */
  revocarOtras(cuentaId: string, salvo: string, ahora: Date): Promise<void>;
  /** Guarda la sede elegida en el usuario, dentro del contexto de su centro. */
  recordarSede(contexto: ContextoCentro, usuarioId: string, sedeId: string | null): Promise<void>;
}

export interface Claves {
  hashear(clave: string): Promise<string>;
  verificar(clave: string, hash: string): Promise<boolean>;
  nuevoToken(): string;
  hashDeToken(token: string): string;
}

export interface Ingreso {
  token: string;
  debeCambiarClave: boolean;
  centros: { id: string; nombre: string }[];
}

/** La sesión resuelta es la misma que la API deja en cada pedido. */
export type CentroActivo = CentroDelPedido;
export type SesionResuelta = SesionDelPedido;

export type ErrorDeIngreso = "credenciales-incorrectas";
export type ErrorDeCentro = "centro-ajeno" | "sin-permisos";
export type ErrorDeSede = "sin-centro" | "sede-ajena";
export type ErrorDeClave = "clave-incorrecta" | "clave-corta";

export interface Acceso {
  entrar(datos: {
    email: string;
    clave: string;
    origen: string;
  }): Promise<Resultado<Ingreso, ErrorDeIngreso>>;
  /** La sesión del token, o undefined si no existe, venció o fue revocada. */
  resolver(token: string): Promise<SesionResuelta | undefined>;
  centros(sesion: SesionResuelta): Promise<{ id: string; nombre: string }[]>;
  /** Las sedes del selector (donde tiene algún permiso), con nombre. Vacío sin centro. */
  sedes(sesion: SesionResuelta): Promise<{ id: string; nombre: string }[]>;
  elegirCentro(sesion: SesionResuelta, centroId: string): Promise<Resultado<null, ErrorDeCentro>>;
  elegirSede(sesion: SesionResuelta, sede: SedeActiva): Promise<Resultado<null, ErrorDeSede>>;
  salir(sesion: SesionResuelta): Promise<void>;
  cambiarClave(
    sesion: SesionResuelta,
    claves: { actual: string; nueva: string },
  ): Promise<Resultado<null, ErrorDeClave>>;
}
