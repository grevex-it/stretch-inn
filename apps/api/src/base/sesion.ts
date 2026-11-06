// Antes de cada ruta: Origin, sesión y lo que la ruta declara que exige (0007 y 0017).
import type { Permiso } from "@app/nucleo";
import { tokenDelPedido, type SesionDelPedido } from "@app/plataforma";
import type { FastifyContextConfig, FastifyReply, FastifyRequest } from "fastify";

export interface DependenciasSesion {
  origenPanel: string;
  resolverSesion: (token: string) => Promise<SesionDelPedido | undefined>;
}

const SIN_CAMBIOS = new Set(["GET", "HEAD", "OPTIONS"]);

function rechazar(respuesta: FastifyReply, estado: number, codigo: string, mensaje: string) {
  return respuesta.code(estado).send({ error: { codigo, mensaje } });
}

/** Algún permiso de alguna sede del contexto; el caso de uso controla la sede puntual. */
function tienePermiso(sesion: SesionDelPedido, permiso: Permiso): boolean {
  const permisos = sesion.centro?.contexto.permisosPorSede.values() ?? [];
  return [...permisos].some((deLaSede) => deLaSede.has(permiso));
}

/** Por qué la sesión no alcanza para la ruta, o undefined si alcanza. */
function faltante(
  sesion: SesionDelPedido,
  config: FastifyContextConfig,
): [codigo: string, mensaje: string] | undefined {
  if (sesion.debeCambiarClave && config.aunConClaveTemporal !== true) {
    return ["debe-cambiar-clave", "Antes de seguir, cambiá tu contraseña temporal."];
  }
  if (config.permiso === undefined) return undefined;
  if (sesion.centro === null) return ["sin-centro", "Primero elegí un centro."];
  if (!tienePermiso(sesion, config.permiso)) {
    return ["sin-permiso", "No tenés permiso para hacer esto."];
  }
  return undefined;
}

async function revisar(
  deps: DependenciasSesion,
  pedido: FastifyRequest,
  respuesta: FastifyReply,
): Promise<void> {
  // Sin ruta (404): no hay nada que exigir.
  if (pedido.routeOptions.url === undefined) return;
  // Además de SameSite, nada que cambie datos llega desde otro sitio (0017).
  if (!SIN_CAMBIOS.has(pedido.method) && pedido.headers.origin !== deps.origenPanel) {
    return rechazar(respuesta, 403, "origen-invalido", "Pedido rechazado: no viene del panel.");
  }
  const config = pedido.routeOptions.config;
  if (config.publica === true) return;
  const token = tokenDelPedido(pedido);
  const sesion = token === undefined ? undefined : await deps.resolverSesion(token);
  if (sesion === undefined) {
    return rechazar(respuesta, 401, "sin-sesion", "Tu sesión terminó. Volvé a entrar.");
  }
  pedido.sesion = sesion;
  const motivo = faltante(sesion, config);
  if (motivo !== undefined) return rechazar(respuesta, 403, ...motivo);
}

/** Hook onRequest: corta el pedido si no cumple lo que declara la ruta. */
export function exigirSesion(
  deps: DependenciasSesion,
): (pedido: FastifyRequest, respuesta: FastifyReply) => Promise<void> {
  return (pedido, respuesta) => revisar(deps, pedido, respuesta);
}
