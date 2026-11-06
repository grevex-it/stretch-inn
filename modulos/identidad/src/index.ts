// API pública del módulo identidad. Lo único que pueden importar los demás.
export type { ErrorDePermisos } from "./aplicacion/casos-de-uso.ts";
export type { NuevaAsignacion, NuevoAjuste } from "./aplicacion/puertos.ts";
export {
  crearCatalogo,
  PERMISOS_IDENTIDAD,
  plantillasDelSistema,
  type Catalogo,
  type PermisoDeclarado,
  type Plantilla,
  type SeccionDePermisos,
} from "./dominio/catalogo.ts";
export {
  faltantesEnAlgunaSede,
  faltantesParaOtorgar,
  permisosEfectivos,
  tieneAccesoTotal,
  tieneMenosPermisos,
  type Ajuste,
  type Asignacion,
  type PermisosPorSede,
} from "./dominio/permisos.ts";
export {
  ajustarPermiso,
  asignarRol,
  cargarPermisos,
  crearRol,
  quitarAsignacion,
} from "./modulo.ts";
export { crearAcceso } from "./modulo-acceso.ts";
export type { Acceso, SesionResuelta } from "./aplicacion/puertos-acceso.ts";
export { rutasDeSesion } from "./http/rutas-sesion.ts";
export { crearEquipo } from "./modulo-equipo.ts";
export { rutasDeEquipo } from "./http/rutas-equipo.ts";
export type { Equipo, ErrorDeEquipo } from "./aplicacion/puertos-equipo.ts";
/** Para cargar cuentas fuera de la app (datos de prueba locales, alta desde soporte). */
export { hashearClave } from "./infraestructura/claves.ts";
