// API pública del módulo agenda. Lo único que pueden importar los demás.
export { crearAgenda, type OpcionesAgenda } from "./modulo.ts";
export type {
  Agenda,
  Clase,
  EdicionDeClase,
  ErrorDeAgenda,
  FechaDeClase,
  NuevaClase,
} from "./aplicacion/puertos.ts";
export { PERMISOS_AGENDA } from "./dominio/permisos.ts";
export { rutasDeAgenda } from "./http/rutas.ts";
