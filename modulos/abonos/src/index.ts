// API pública del módulo abonos. Lo único que pueden importar los demás.
export { crearAbonos, type OpcionesAbonos } from "./modulo.ts";
export type { Abonos, Cuota, ErrorDeAbonos, NuevoPlan, Plan } from "./aplicacion/puertos.ts";
export { PERMISOS_ABONOS } from "./dominio/permisos.ts";
export { rutasDeAbonos } from "./http/rutas.ts";
export { obtenerCuota, registrarPago, revertirPago } from "./infraestructura/para-otros.ts";
