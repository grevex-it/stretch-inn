// Rutas /asistencia. El permiso en la sede de la fecha lo controla el módulo (0007).
import {
  pedidoDeAsistencia,
  pedidoDeAviso,
  pedidoDePagina,
  pedidoDeRecuperacion,
  reglasDeRecuperacion,
} from "@app/contratos";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { z } from "zod";
import type { Asistencia } from "../aplicacion/puertos.ts";
import { enviar, leer } from "./comun.ts";

const ver = { permiso: "asistencia.ver" } as const;
const tomar = { permiso: "asistencia.tomar" } as const;
const avisar = { permiso: "asistencia.avisar" } as const;
const recuperar = { permiso: "asistencia.recuperar" } as const;
const conId = z.object({ id: z.uuid("Esa fecha no existe.") });
const avisoConId = z.object({ id: z.uuid("Ese aviso no existe.") });
const sedeConId = z.object({ id: z.uuid("Esa sede no existe.") });
const configurar = { permiso: "asistencia.configurar" } as const;
const recuperacionConId = z.object({ id: z.uuid("Esa recuperación no existe.") });

export function rutasDeAsistencia(asistencia: Asistencia): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    rutasDePlanilla(app, asistencia);
    rutasDeAvisos(app, asistencia);
    rutasDeRecuperaciones(app, asistencia);
    rutasDeReglas(app, asistencia);
    listo();
  };
}

function rutasDePlanilla(app: FastifyInstance, asistencia: Asistencia): void {
  app.get("/asistencia/fechas/:id", { config: ver }, async (pedido, respuesta) => {
    const fecha = leer(conId, pedido.params, respuesta);
    const pagina = fecha && leer(pedidoDePagina, pedido.query, respuesta);
    if (fecha === undefined || pagina === undefined) return respuesta;
    const resultado = await asistencia.planilla(contextoDe(pedido), {
      ...pagina,
      fechaId: fecha.id,
    });
    return enviar(respuesta, resultado, 200);
  });

  app.put("/asistencia/fechas/:id", { config: tomar }, async (pedido, respuesta) => {
    const fecha = leer(conId, pedido.params, respuesta);
    const datos = fecha && leer(pedidoDeAsistencia, pedido.body, respuesta);
    if (fecha === undefined || datos === undefined) return respuesta;
    const resultado = await asistencia.tomar(contextoDe(pedido), {
      fechaId: fecha.id,
      marcas: datos.marcas,
    });
    return enviar(respuesta, resultado, 204);
  });
}

function rutasDeAvisos(app: FastifyInstance, asistencia: Asistencia): void {
  app.post("/asistencia/fechas/:id/avisos", { config: avisar }, async (pedido, respuesta) => {
    const fecha = leer(conId, pedido.params, respuesta);
    const datos = fecha && leer(pedidoDeAviso, pedido.body, respuesta);
    if (fecha === undefined || datos === undefined) return respuesta;
    const resultado = await asistencia.avisar(contextoDe(pedido), {
      fechaId: fecha.id,
      alumnoId: datos.alumnoId,
    });
    return enviar(respuesta, resultado, 201);
  });

  app.delete("/asistencia/avisos/:id", { config: avisar }, async (pedido, respuesta) => {
    const aviso = leer(avisoConId, pedido.params, respuesta);
    if (aviso === undefined) return respuesta;
    const resultado = await asistencia.anularAviso(contextoDe(pedido), aviso);
    return enviar(respuesta, resultado, 204);
  });
}

function rutasDeRecuperaciones(app: FastifyInstance, asistencia: Asistencia): void {
  app.post(
    "/asistencia/fechas/:id/recuperaciones",
    { config: recuperar },
    async (pedido, respuesta) => {
      const fecha = leer(conId, pedido.params, respuesta);
      const datos = fecha && leer(pedidoDeRecuperacion, pedido.body, respuesta);
      if (fecha === undefined || datos === undefined) return respuesta;
      const resultado = await asistencia.recuperar(contextoDe(pedido), {
        fechaId: fecha.id,
        alumnoId: datos.alumnoId,
      });
      return enviar(respuesta, resultado, 201);
    },
  );

  app.delete("/asistencia/recuperaciones/:id", { config: recuperar }, async (pedido, respuesta) => {
    const reserva = leer(recuperacionConId, pedido.params, respuesta);
    if (reserva === undefined) return respuesta;
    const resultado = await asistencia.anularRecuperacion(contextoDe(pedido), reserva);
    return enviar(respuesta, resultado, 204);
  });
}

/** Las reglas de recuperación de cada sede (0020). */
function rutasDeReglas(app: FastifyInstance, asistencia: Asistencia): void {
  app.get("/asistencia/sedes/:id/reglas", { config: ver }, async (pedido, respuesta) => {
    const sede = leer(sedeConId, pedido.params, respuesta);
    if (sede === undefined) return respuesta;
    const resultado = await asistencia.reglas(contextoDe(pedido), { sedeId: sede.id });
    return enviar(respuesta, resultado, 200);
  });

  app.put("/asistencia/sedes/:id/reglas", { config: configurar }, async (pedido, respuesta) => {
    const sede = leer(sedeConId, pedido.params, respuesta);
    const reglas = sede && leer(reglasDeRecuperacion, pedido.body, respuesta);
    if (sede === undefined || reglas === undefined) return respuesta;
    const resultado = await asistencia.fijarReglas(contextoDe(pedido), {
      ...reglas,
      sedeId: sede.id,
    });
    return enviar(respuesta, resultado, 204);
  });
}
