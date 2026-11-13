// API pública del módulo agenda. Lo único que pueden importar los demás.
export { crearAgenda, type OpcionesAgenda } from "./modulo.ts";
export type {
  Agenda,
  Clase,
  EdicionDeClase,
  ErrorDeAgenda,
  FechaDeClase,
  Inscripto,
  NuevaClase,
} from "./aplicacion/puertos.ts";
export { PERMISOS_AGENDA } from "./dominio/permisos.ts";
export {
  estabanInscriptos,
  inscriptosEnFecha,
  obtenerFecha,
  type FechaParaOtros,
} from "./infraestructura/para-otros.ts";
export { liberarLugares } from "./infraestructura/liberar-lugares.ts";
export { fechasDeAlumno, type FechaDeAlumno } from "./infraestructura/fechas-de-alumno.ts";
export { rutasDeAgenda } from "./http/rutas.ts";
