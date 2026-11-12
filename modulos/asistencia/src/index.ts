// API pública del módulo asistencia. Lo único que pueden importar los demás.
export { crearAsistencia, type OpcionesAsistencia } from "./modulo.ts";
export type {
  Asistencia,
  Credito,
  ErrorDeAsistencia,
  Fecha,
  Planilla,
  Renglon,
} from "./aplicacion/puertos.ts";
export type { Estado, Marca } from "./dominio/planilla.ts";
export { PERMISOS_ASISTENCIA } from "./dominio/permisos.ts";
export { rutasDeAsistencia } from "./http/rutas.ts";
