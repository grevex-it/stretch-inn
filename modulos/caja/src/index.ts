// API pública del módulo caja. Lo único que pueden importar los demás.
export { crearCaja, type OpcionesCaja } from "./modulo.ts";
export type { Caja, ErrorDeCaja, Pago } from "./aplicacion/puertos.ts";
export { MEDIOS, type Medio } from "./dominio/cobro.ts";
export { PERMISOS_CAJA } from "./dominio/permisos.ts";
export { rutasDeCaja } from "./http/rutas.ts";
