// Los permisos del módulo (0007): cada módulo declara los suyos y el centro los combina en roles.
import type { Permiso } from "@app/nucleo";

export const PERMISOS_PERSONAS: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Alumnos",
  permisos: [
    { permiso: "personas.ver", descripcion: "Ver los alumnos y sus fichas" },
    { permiso: "personas.editar", descripcion: "Dar de alta, editar y dar de baja alumnos" },
  ],
};
