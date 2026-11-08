// Los permisos del módulo (0007). [SUPUESTO] Los planes son del centro: gestionarlos pide el
// permiso en alguna sede; el precio de una sede y las cuotas, en esa sede.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "abonos.ver";
export const GESTIONAR: Permiso = "abonos.gestionar";
export const ASIGNAR: Permiso = "abonos.asignar";

export const PERMISOS_ABONOS: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Abonos",
  permisos: [
    { permiso: VER, descripcion: "Ver los planes, sus precios y las cuotas de los alumnos" },
    { permiso: GESTIONAR, descripcion: "Crear y editar planes y sus precios por sede" },
    { permiso: ASIGNAR, descripcion: "Generar y anular la cuota mensual de un alumno" },
  ],
};
