// API pública de @app/nucleo: tipos puros, sin dependencias.
export { multiplicar, pesos, restar, sumar, type Dinero } from "./dinero.ts";
export {
  id,
  puede,
  sedesVisibles,
  type Actor,
  type CentroId,
  type ContextoCentro,
  type Id,
  type OperadorId,
  type Permiso,
  type SedeId,
  type UsuarioId,
} from "./contexto.ts";
export { falla, ok, type Falla, type Resultado } from "./resultado.ts";
