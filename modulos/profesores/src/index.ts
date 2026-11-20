// API pública del módulo profesores. Lo único que pueden importar los demás.
export { crearProfesores, type OpcionesProfesores } from "./modulo.ts";
export type { ErrorDeProfesores, Profe, Profesores, TarifaGuardada } from "./aplicacion/puertos.ts";
export { PERMISOS_PROFESORES } from "./dominio/permisos.ts";
export { rutasDeProfesores } from "./http/rutas.ts";
