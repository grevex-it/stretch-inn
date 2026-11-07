// API pública del módulo personas. Lo único que pueden importar los demás.
export {
  crearAlumno,
  editarAlumno,
  fijarActivo,
  listarAlumnos,
  obtenerAlumno,
  obtenerAlumnos,
} from "./datos/alumnos.ts";
export type {
  Alumno,
  BusquedaDeAlumnos,
  DatosDeAlumno,
  ErrorDeAlumno,
  PaginaDeAlumnos,
} from "./datos/tipos.ts";
export { rutasDeAlumnos } from "./http/rutas.ts";
export { PERMISOS_PERSONAS } from "./datos/permisos.ts";
