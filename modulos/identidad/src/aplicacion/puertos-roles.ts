// Lo que los roles a medida, las asignaciones y los ajustes necesitan de afuera (0003 y 0007).
import type { ContextoCentro, Permiso, Resultado } from "@app/nucleo";
import type { SeccionDePermisos } from "../dominio/catalogo.ts";
import type { ErrorDeCambioDePermisos } from "../dominio/equipo.ts";
import type {
  FilaDePermiso,
  NuevaAsignacion,
  NuevoAjuste,
  RepositorioIdentidad,
} from "./puertos.ts";

export interface RolGuardado {
  id: string;
  nombre: string;
  /** La plantilla de la que salió (no se edita), o null si es propio del centro. */
  plantilla: string | null;
  permisos: Permiso[];
  version: number;
}

export interface DatosDeRol {
  nombre: string;
  permisos: readonly Permiso[];
}

export interface EdicionDeRol extends DatosDeRol {
  id: string;
  version: number;
}

/** De dónde viene cada permiso de un integrante en una sede, y si al final lo tiene. */
export interface PermisoConOrigen {
  sedeId: string;
  permiso: Permiso;
  roles: string[];
  ajuste: "extra" | "quitado" | null;
  efectivo: boolean;
}

export interface PermisosDeIntegrante {
  asignaciones: { sedeId: string; rolId: string; rol: string }[];
  permisos: PermisoConOrigen[];
  /** Si tiene roles o ajustes en sedes que no están en el contexto de quien consulta. */
  enOtrasSedes: boolean;
}

export interface AsignacionConPermisos {
  sedeId: string;
  rolId: string;
  rol: string;
  permisos: Permiso[];
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioRoles extends RepositorioIdentidad {
  /** El rol del centro con sus permisos, o undefined si no existe. */
  rol(rolId: string): Promise<RolGuardado | undefined>;
  /** Devuelve la versión nueva, o undefined si el rol cambió desde `version`. */
  editarRol(rol: EdicionDeRol): Promise<number | undefined>;
  borrarRol(rolId: string): Promise<void>;
  /** Función de alcance mínimo: quiénes lo tienen, en todas las sedes del centro. */
  asignacionesDelRol(rolId: string): Promise<{ nombre: string; sedeId: string }[]>;
  existeUsuario(usuarioId: string): Promise<boolean>;
  /** Función de alcance mínimo: en todas sus sedes, para compararlo con quien gestiona. */
  permisosDeUsuario(usuarioId: string): Promise<FilaDePermiso[]>;
  /** Función de alcance mínimo: si tiene el Dueño o la Contaduría (por su marca) en alguna sede. */
  esProtegido(usuarioId: string): Promise<boolean>;
  /** Sus roles y ajustes en las sedes que ve quien consulta. */
  rolesYAjustesDe(usuarioId: string): Promise<{
    asignaciones: AsignacionConPermisos[];
    ajustes: { sedeId: string; permiso: Permiso; tipo: "extra" | "quitado" }[];
  }>;
  /** Devuelve si había un ajuste para quitar. */
  quitarAjuste(ajuste: Omit<NuevoAjuste, "tipo">): Promise<boolean>;
}

export type ErrorDeRoles =
  | ErrorDeCambioDePermisos
  | "nombre-vacio"
  | "nombre-repetido"
  | "permisos-ajenos"
  | "permiso-inexistente"
  | "rol-inexistente"
  | "rol-de-plantilla"
  | "rol-en-uso"
  | "cambio-concurrente"
  | "usuario-inexistente"
  | "asignacion-inexistente"
  | "ajuste-inexistente"
  | "ultimo-acceso-total";

type Respuesta<T> = Promise<Resultado<T, ErrorDeRoles>>;
type EnSede<T> = Omit<T, "usuarioId">;

/** Roles a medida y permisos de cada integrante. Cada operación, en su propia transacción. */
export interface Roles {
  catalogo(): readonly SeccionDePermisos[];
  rol(quien: ContextoCentro, rolId: string): Respuesta<RolGuardado>;
  crearRol(quien: ContextoCentro, rol: DatosDeRol): Respuesta<{ id: string }>;
  editarRol(quien: ContextoCentro, rol: EdicionDeRol): Respuesta<{ version: number }>;
  borrarRol(quien: ContextoCentro, rolId: string): Respuesta<null>;
  permisosDe(quien: ContextoCentro, usuarioId: string): Respuesta<PermisosDeIntegrante>;
  asignar(quien: ContextoCentro, usuarioId: string, a: EnSede<NuevaAsignacion>): Respuesta<null>;
  quitarAsignacion(
    quien: ContextoCentro,
    usuarioId: string,
    asignacion: EnSede<NuevaAsignacion>,
  ): Respuesta<null>;
  ajustar(quien: ContextoCentro, usuarioId: string, ajuste: EnSede<NuevoAjuste>): Respuesta<null>;
  quitarAjuste(
    quien: ContextoCentro,
    usuarioId: string,
    ajuste: Omit<EnSede<NuevoAjuste>, "tipo">,
  ): Respuesta<null>;
}
