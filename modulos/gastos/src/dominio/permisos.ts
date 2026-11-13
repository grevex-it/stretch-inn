// Los permisos del módulo (0007). Se controlan en la sede del gasto.
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "gastos.ver";
export const CARGAR: Permiso = "gastos.cargar";
export const ANULAR: Permiso = "gastos.anular";

export const PERMISOS_GASTOS: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Gastos",
  permisos: [
    { permiso: VER, descripcion: "Ver los gastos de la sede y lo gastado" },
    { permiso: CARGAR, descripcion: "Cargar gastos" },
    { permiso: ANULAR, descripcion: "Anular gastos, con un motivo" },
  ],
};
