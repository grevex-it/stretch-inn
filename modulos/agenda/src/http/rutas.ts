// Rutas de la agenda. Solo traducen HTTP ↔ Agenda: la API ya resolvió la sesión y exigió el
// permiso en alguna sede; el permiso en la sede puntual lo controla el módulo (0007).
import { edicionDeClase, fichaDeClase, pedidoDeClases, pedidoDeOcurrencias } from "@app/contratos";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { z } from "zod";
import type { Agenda } from "../aplicacion/puertos.ts";
import { enviar, leer } from "./comun.ts";

const ver = { permiso: "agenda.ver" } as const;
const gestionar = { permiso: "agenda.gestionar" } as const;
const conId = z.object({ id: z.uuid("Eso no existe en la agenda.") });

function clases(app: FastifyInstance, agenda: Agenda): void {
  app.get("/agenda/clases", { config: ver }, async (pedido, respuesta) => {
    const filtro = leer(pedidoDeClases, pedido.query, respuesta);
    if (filtro === undefined) return respuesta;
    return enviar(respuesta, await agenda.clases(contextoDe(pedido), filtro), 200);
  });

  app.post("/agenda/clases", { config: gestionar }, async (pedido, respuesta) => {
    const clase = leer(fichaDeClase, pedido.body, respuesta);
    if (clase === undefined) return respuesta;
    return enviar(respuesta, await agenda.crearClase(contextoDe(pedido), clase), 201);
  });

  app.put("/agenda/clases/:id", { config: gestionar }, async (pedido, respuesta) => {
    const clase = leer(conId, pedido.params, respuesta);
    const cambio = clase && leer(edicionDeClase, pedido.body, respuesta);
    if (clase === undefined || cambio === undefined) return respuesta;
    const resultado = await agenda.editarClase(contextoDe(pedido), { ...cambio, id: clase.id });
    return enviar(respuesta, resultado, 200);
  });

  // PUT da de baja; DELETE quita la baja (reactiva).
  for (const [metodo, activa] of [
    ["PUT", false],
    ["DELETE", true],
  ] as const) {
    app.route({
      method: metodo,
      url: "/agenda/clases/:id/baja",
      config: gestionar,
      handler: async (pedido, respuesta) => {
        const clase = leer(conId, pedido.params, respuesta);
        if (clase === undefined) return respuesta;
        const resultado = await agenda.fijarActiva(contextoDe(pedido), { id: clase.id, activa });
        return enviar(respuesta, resultado, 204);
      },
    });
  }
}

function ocurrencias(app: FastifyInstance, agenda: Agenda): void {
  app.get("/agenda/ocurrencias", { config: ver }, async (pedido, respuesta) => {
    const filtro = leer(pedidoDeOcurrencias, pedido.query, respuesta);
    if (filtro === undefined) return respuesta;
    return enviar(respuesta, await agenda.semana(contextoDe(pedido), filtro), 200);
  });

  // PUT cancela la fecha; DELETE deshace la cancelación.
  for (const [metodo, cancelada] of [
    ["PUT", true],
    ["DELETE", false],
  ] as const) {
    app.route({
      method: metodo,
      url: "/agenda/ocurrencias/:id/cancelada",
      config: gestionar,
      handler: async (pedido, respuesta) => {
        const fecha = leer(conId, pedido.params, respuesta);
        if (fecha === undefined) return respuesta;
        const cambio = { id: fecha.id, cancelada };
        return enviar(respuesta, await agenda.fijarCancelada(contextoDe(pedido), cambio), 204);
      },
    });
  }
}

export function rutasDeAgenda(agenda: Agenda): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    clases(app, agenda);
    ocurrencias(app, agenda);
    listo();
  };
}
