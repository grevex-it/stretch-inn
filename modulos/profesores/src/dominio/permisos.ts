// Los permisos del módulo (0007, 0024). Las tarifas de una sede se controlan en esa sede; las del
// centro y el tipo de profe, en alguna.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "profesores.ver";
export const CONFIGURAR: Permiso = "profesores.configurar";

export const PERMISOS_PROFESORES: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Profesores",
  permisos: [
    { permiso: VER, descripcion: "Ver los profes, su tipo y las tarifas por clase" },
    { permiso: CONFIGURAR, descripcion: "Fijar el tipo de cada profe y las tarifas por clase" },
  ],
};
