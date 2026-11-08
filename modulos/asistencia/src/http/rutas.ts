// Rutas /asistencia. El permiso en la sede de la fecha lo controla el módulo (0007).
import { pedidoDeAsistencia, pedidoDePagina } from "@app/contratos";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";
import type { Asistencia } from "../aplicacion/puertos.ts";
import { enviar, leer } from "./comun.ts";

const ver = { permiso: "asistencia.ver" } as const;
const tomar = { permiso: "asistencia.tomar" } as const;
const conId = z.object({ id: z.uuid("Esa fecha no existe.") });

export function rutasDeAsistencia(asistencia: Asistencia): FastifyPluginCallback {
  return (app, _opciones, listo) => {
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
    listo();
  };
}
