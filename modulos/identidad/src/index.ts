// API pública del módulo identidad. Lo único que pueden importar los demás.
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
