// Rutas del equipo del centro (ver docs/decisiones/0017). Solo traducen HTTP ↔ Equipo: la API ya
// resolvió la sesión y exigió el permiso en alguna sede; las reglas finas las aplica el módulo.
import { pedidoDeAlta, pedidoDePagina } from "@app/contratos";
import type { Resultado } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import { z } from "zod";
import type { Equipo, ErrorDeEquipo } from "../aplicacion/puertos-equipo.ts";
import { leer, responder } from "./comun.ts";

const ver = { permiso: "usuarios.ver" } as const;
const gestionar = { permiso: "usuarios.gestionar" } as const;
const conId = z.object({ id: z.uuid("Esa persona no existe.") });

const ESTADOS: Record<ErrorDeEquipo, number> = {
  "nombre-vacio": 400,
  "sin-sedes": 400,
  "rol-inexistente": 400,
  "permisos-ajenos": 403,
  "a-vos-mismo": 403,
  "mas-permisos": 403,
  "otros-centros": 403,
  "usuario-inexistente": 404,
  "ya-es-del-equipo": 409,
};

/** Responde el valor con ese estado, o la falla con el suyo. */
function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeEquipo>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) return responder(respuesta, ESTADOS[resultado.error.codigo], resultado.error);
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}

/** Las claves temporales se muestran una sola vez: que no queden en ningún caché. */
function sinCache(respuesta: FastifyReply): FastifyReply {
  return respuesta.header("cache-control", "no-store");
}

export function rutasDeEquipo(equipo: Equipo): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    app.get("/equipo", { config: ver }, async (pedido, respuesta) => {
      const pagina = leer(pedidoDePagina, pedido.query, respuesta);
      if (pagina === undefined) return respuesta;
      return equipo.listar(contextoDe(pedido), pagina);
    });

    app.get("/equipo/roles", { config: gestionar }, async (pedido, respuesta) => {
      const pagina = leer(pedidoDePagina, pedido.query, respuesta);
      if (pagina === undefined) return respuesta;
      return equipo.roles(contextoDe(pedido), pagina);
    });

    app.post("/equipo", { config: gestionar }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeAlta, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      return enviar(sinCache(respuesta), await equipo.darDeAlta(contextoDe(pedido), datos), 201);
    });

    app.post("/equipo/:id/clave", { config: gestionar }, async (pedido, respuesta) => {
      const usuario = leer(conId, pedido.params, respuesta);
      if (usuario === undefined) return respuesta;
      const reset = await equipo.resetearClave(contextoDe(pedido), usuario.id);
      return enviar(sinCache(respuesta), reset, 200);
    });

    app.put("/equipo/:id/bloqueo", { config: gestionar }, async (pedido, respuesta) => {
      const usuario = leer(conId, pedido.params, respuesta);
      if (usuario === undefined) return respuesta;
      return enviar(respuesta, await equipo.bloquear(contextoDe(pedido), usuario.id), 204);
    });

    app.delete("/equipo/:id/bloqueo", { config: gestionar }, async (pedido, respuesta) => {
      const usuario = leer(conId, pedido.params, respuesta);
      if (usuario === undefined) return respuesta;
      return enviar(respuesta, await equipo.reactivar(contextoDe(pedido), usuario.id), 204);
    });
    listo();
  };
}
