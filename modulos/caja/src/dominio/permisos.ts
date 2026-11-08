// Los permisos del módulo (0007), como en el ejemplo de la decisión. Se controlan en la sede del
// pago (la de la cuota).
import type { Permiso } from "@app/nucleo";

export const VER: Permiso = "caja.ver";
export const COBRAR: Permiso = "caja.cobrar";
export const ANULAR: Permiso = "caja.anular";

export const PERMISOS_CAJA: {
  seccion: string;
  permisos: readonly { permiso: Permiso; descripcion: string }[];
} = {
  seccion: "Caja",
  permisos: [
    { permiso: VER, descripcion: "Ver los pagos del día y lo cobrado" },
    { permiso: COBRAR, descripcion: "Cobrar cuotas" },
    { permiso: ANULAR, descripcion: "Anular pagos, con un motivo" },
  ],
};
