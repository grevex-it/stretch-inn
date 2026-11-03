// Lo que los casos de uso necesitan de la base (ver docs/decisiones/0003, regla de puertos).
import type { Permiso } from "@app/nucleo";

/** Un permiso de un usuario en una sede y de dónde viene. */
export interface FilaDePermiso {
  sedeId: string;
  permiso: Permiso;
  origen: "rol" | "extra" | "quitado";
}

export interface FilaDePermisoDeUsuario extends FilaDePermiso {
  usuarioId: string;
}

export interface NuevaAsignacion {
  usuarioId: string;
  sedeId: string;
  rolId: string;
}

export interface NuevoAjuste {
  usuarioId: string;
  sedeId: string;
  permiso: Permiso;
  tipo: "extra" | "quitado";
}

export interface RepositorioIdentidad {
  /** Permisos de una cuenta en un centro, sin necesitar contexto (función de alcance mínimo). */
  permisosDe(cuentaId: string, centroId: string): Promise<FilaDePermiso[]>;
  /** Permisos de todos los usuarios activos del centro del contexto, en todas sus sedes. */
  permisosDelCentro(): Promise<FilaDePermisoDeUsuario[]>;
  /** Ids de todas las sedes del centro del contexto, las vea o no el actor. */
  sedesDelCentro(): Promise<string[]>;
  existeRolConNombre(nombre: string): Promise<boolean>;
  crearRol(rol: { id: string; nombre: string; permisos: readonly Permiso[] }): Promise<void>;
  /** Los permisos del rol, o undefined si no existe en el centro. */
  permisosDeRol(rolId: string): Promise<Permiso[] | undefined>;
  asignar(asignacion: NuevaAsignacion): Promise<void>;
  /** Devuelve si había algo para quitar. */
  quitarAsignacion(asignacion: NuevaAsignacion): Promise<boolean>;
  ajustar(ajuste: NuevoAjuste): Promise<void>;
}
