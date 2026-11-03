// API pública de @app/plataforma.
export {
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
