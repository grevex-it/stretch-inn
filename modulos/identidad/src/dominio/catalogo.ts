// Catálogo de permisos: lista fija en el código. Cada módulo declara los suyos, agrupados por
// sección; el centro no inventa permisos, los combina en roles (ver docs/decisiones/0007).
import type { Permiso } from "@app/nucleo";

export interface PermisoDeclarado {
  permiso: Permiso;
  descripcion: string;
}

export interface SeccionDePermisos {
  seccion: string;
  permisos: readonly PermisoDeclarado[];
}

export interface Catalogo {
  secciones: readonly SeccionDePermisos[];
  todos: readonly Permiso[];
}

export interface Plantilla {
  nombre: string;
  /**
   * Marca el rol del centro que sale de esta plantilla (columna `roles.plantilla`). Sigue aunque
   * el centro lo renombre: así las migraciones le dan al Dueño los permisos de cada módulo nuevo.
   */
  plantilla: "dueno";
  permisos: readonly Permiso[];
}

/** Los permisos del propio módulo identidad. */
export const PERMISOS_IDENTIDAD: SeccionDePermisos = {
  seccion: "Usuarios y roles",
  permisos: [
    { permiso: "usuarios.ver", descripcion: "Ver los usuarios y sus permisos" },
    { permiso: "usuarios.gestionar", descripcion: "Dar de alta, editar y resetear usuarios" },
    { permiso: "roles.gestionar", descripcion: "Crear y editar roles" },
  ],
};

const FORMA = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Junta las secciones de todos los módulos. Falla al arrancar si un permiso es inválido. */
export function crearCatalogo(secciones: readonly SeccionDePermisos[]): Catalogo {
  const todos: Permiso[] = [];
  for (const { permiso } of secciones.flatMap((seccion) => seccion.permisos)) {
    if (!FORMA.test(permiso)) {
      throw new Error(`El permiso "${permiso}" no tiene la forma modulo.accion en minúsculas.`);
    }
    if (todos.includes(permiso)) {
      throw new Error(`El permiso "${permiso}" está repetido en el catálogo.`);
    }
    todos.push(permiso);
  }
  return { secciones, todos };
}

/** Plantillas que vienen con el sistema: no se editan, se copian al centro en el alta. */
export function plantillasDelSistema(catalogo: Catalogo): Plantilla[] {
  return [{ nombre: "Dueño", plantilla: "dueno", permisos: catalogo.todos }];
}
