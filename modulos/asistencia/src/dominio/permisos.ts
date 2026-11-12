// Los permisos del módulo (0007). Se controlan en la sede de la fecha.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "asistencia.ver";
export const TOMAR: Permiso = "asistencia.tomar";

export const PERMISOS_ASISTENCIA: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Asistencia",
  permisos: [
    { permiso: VER, descripcion: "Ver la asistencia de cada fecha" },
    { permiso: TOMAR, descripcion: "Tomar y corregir la asistencia" },
  ],
};
