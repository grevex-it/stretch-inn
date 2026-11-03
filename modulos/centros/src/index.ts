// API pública del módulo centros. Lo único que pueden importar los demás.
export {
  crearCentro,
  listarSedes,
  obtenerCentro,
  renombrarSede,
  type CambioDeNombre,
  type Centro,
  type NuevaSede,
  type NuevoCentro,
  type Sede,
} from "./datos/centros.ts";
