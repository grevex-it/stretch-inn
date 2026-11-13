// Rutas de la agenda. Solo traducen HTTP ↔ Agenda: la API ya resolvió la sesión y exigió el
// permiso en alguna sede; el permiso en la sede puntual lo controla el módulo (0007).
import {
  camasDeSede,
  edicionDeClase,
  fichaDeClase,
  pedidoDeClases,
  pedidoDeDictadas,
  pedidoDeOcurrencias,
  profeDeSede,
} from "@app/contratos";
import { ok } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { z } from "zod";
import type { Agenda } from "../aplicacion/puertos.ts";
import { enviar, leer } from "./comun.ts";
import { rutasDeInscripciones } from "./rutas-inscripciones.ts";

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

/** Las camas de la sede: el tope del cupo de sus clases. */
function camas(app: FastifyInstance, agenda: Agenda): void {
  const url = "/agenda/sedes/:id/camas";
  app.get(url, { config: ver }, async (pedido, respuesta) => {
    const sede = leer(conId, pedido.params, respuesta);
    if (sede === undefined) return respuesta;
    const resultado = await agenda.camas(contextoDe(pedido), { sedeId: sede.id });
    return enviar(respuesta, resultado.ok ? ok({ camas: resultado.valor }) : resultado, 200);
  });

  app.put(url, { config: gestionar }, async (pedido, respuesta) => {
    const sede = leer(conId, pedido.params, respuesta);
    const cambio = sede && leer(camasDeSede, pedido.body, respuesta);
    if (sede === undefined || cambio === undefined) return respuesta;
    const resultado = await agenda.fijarCamas(contextoDe(pedido), { sedeId: sede.id, ...cambio });
    return enviar(respuesta, resultado, 204);
  });
}

/** El profe fijo de la sede y el reemplazo de una fecha (0022). */
function profes(app: FastifyInstance, agenda: Agenda): void {
  const url = "/agenda/sedes/:id/profe";
  app.get(url, { config: ver }, async (pedido, respuesta) => {
    const sede = leer(conId, pedido.params, respuesta);
    if (sede === undefined) return respuesta;
    const resultado = await agenda.profeDeSede(contextoDe(pedido), { sedeId: sede.id });
    return enviar(respuesta, resultado.ok ? ok({ profeId: resultado.valor }) : resultado, 200);
  });

  app.put(url, { config: gestionar }, async (pedido, respuesta) => {
    const sede = leer(conId, pedido.params, respuesta);
    const cambio = sede && leer(profeDeSede, pedido.body, respuesta);
    if (sede === undefined || cambio === undefined) return respuesta;
    const resultado = await agenda.fijarProfeDeSede(contextoDe(pedido), {
      sedeId: sede.id,
      ...cambio,
    });
    return enviar(respuesta, resultado, 204);
  });

  // Para pagarles por clase (0022): cuántas dio cada uno en el período.
  app.get("/agenda/clases-dictadas", { config: gestionar }, async (pedido, respuesta) => {
    const filtro = leer(pedidoDeDictadas, pedido.query, respuesta);
    if (filtro === undefined) return respuesta;
    return enviar(respuesta, await agenda.clasesDictadas(contextoDe(pedido), filtro), 200);
  });

  app.put("/agenda/ocurrencias/:id/profe", { config: gestionar }, async (pedido, respuesta) => {
    const fecha = leer(conId, pedido.params, respuesta);
    const cambio = fecha && leer(profeDeSede, pedido.body, respuesta);
    if (fecha === undefined || cambio === undefined) return respuesta;
    const resultado = await agenda.fijarProfeDeFecha(contextoDe(pedido), {
      id: fecha.id,
      ...cambio,
    });
    return enviar(respuesta, resultado, 204);
  });
}

export function rutasDeAgenda(agenda: Agenda): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    clases(app, agenda);
    ocurrencias(app, agenda);
    camas(app, agenda);
    profes(app, agenda);
    rutasDeInscripciones(app, agenda);
    listo();
  };
}
