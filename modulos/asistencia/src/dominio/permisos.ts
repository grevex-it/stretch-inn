// Los permisos del módulo (0007). Se controlan en la sede de la fecha.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "asistencia.ver";
export const TOMAR: Permiso = "asistencia.tomar";
export const AVISAR: Permiso = "asistencia.avisar";
export const RECUPERAR: Permiso = "asistencia.recuperar";
export const CONFIGURAR: Permiso = "asistencia.configurar";

export const PERMISOS_ASISTENCIA: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Asistencia",
  permisos: [
    { permiso: VER, descripcion: "Ver la asistencia de cada fecha" },
    { permiso: TOMAR, descripcion: "Tomar y corregir la asistencia" },
    { permiso: AVISAR, descripcion: "Registrar y anular ausencias avisadas" },
    { permiso: RECUPERAR, descripcion: "Reservar y anular recuperaciones" },
    {
      permiso: CONFIGURAR,
      descripcion: "Configurar las reglas de recuperación de la sede",
    },
  ],
};
