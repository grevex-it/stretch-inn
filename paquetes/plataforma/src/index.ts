// API pública de @app/plataforma.
export {
  comprobarBase,
  crearBase,
  enContexto,
  verificarRolSeguro,
  type Base,
  type OpcionesBase,
  type Transaccion,
} from "./base.ts";
export {
  codigoDeTraza,
  crearLogger,
  nuevaTraza,
  type Logger,
  type OpcionesLogger,
} from "./logs.ts";
export {
  COLA_FALLIDOS,
  crearCola,
  declararTarea,
  publicar,
  trabajar,
  type Cola,
  type OpcionesCola,
  type OpcionesPublicar,
  type OpcionesTarea,
} from "./cola.ts";
