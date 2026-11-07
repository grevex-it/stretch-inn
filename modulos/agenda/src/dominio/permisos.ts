// Los permisos del módulo (0007). Todos se controlan por sede: la clase es de una sede.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "agenda.ver";
export const GESTIONAR: Permiso = "agenda.gestionar";
export const INSCRIBIR: Permiso = "agenda.inscribir";

export const PERMISOS_AGENDA: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Agenda",
  permisos: [
    { permiso: VER, descripcion: "Ver las clases, sus fechas y sus inscriptos" },
    { permiso: GESTIONAR, descripcion: "Crear, editar y dar de baja clases, y cancelar fechas" },
    { permiso: INSCRIBIR, descripcion: "Inscribir alumnos en las clases y darlos de baja" },
  ],
};
