// API pública del módulo gastos. Lo único que pueden importar los demás.
export { crearGastos, type OpcionesGastos } from "./modulo.ts";
export type { ErrorDeGastos, Gasto, Gastos } from "./aplicacion/puertos.ts";
export { CATEGORIAS, MEDIOS_DE_GASTO } from "./dominio/gasto.ts";
export { PERMISOS_GASTOS } from "./dominio/permisos.ts";
export { rutasDeGastos } from "./http/rutas.ts";
