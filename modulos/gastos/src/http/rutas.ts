// Rutas /gastos. El permiso en la sede del gasto lo controla el módulo (0007).
import { pedidoDeAnulacion, pedidoDeGasto, pedidoDeGastos } from "@app/contratos";
import type { Resultado } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import { z } from "zod";
import type { ErrorDeGastos, Gastos } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeGastos, number> = {
  "fecha-invalida": 400,
  "monto-invalido": 400,
  "categoria-invalida": 400,
  "medio-invalido": 400,
  "descripcion-larga": 400,
  "clave-invalida": 400,
  "motivo-vacio": 400,
  "periodo-invalido": 400,
  "sin-permiso": 403,
  "gasto-inexistente": 404,
  "clave-usada": 409,
  "gasto-anulado": 409,
};

const conId = z.object({ id: z.uuid("Ese gasto no existe.") });

function leer<T>(esquema: z.ZodType<T>, dato: unknown, respuesta: FastifyReply): T | undefined {
  const resultado = esquema.safeParse(dato);
  if (resultado.success) return resultado.data;
  const mensaje = resultado.error.issues[0]?.message ?? "Revisá los datos.";
  void respuesta.code(400).send({ error: { codigo: "pedido-invalido", mensaje } });
  return undefined;
}

function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeGastos>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}

export function rutasDeGastos(gastos: Gastos): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    app.post("/gastos", { config: { permiso: "gastos.cargar" } }, async (pedido, respuesta) => {
      const gasto = leer(pedidoDeGasto, pedido.body, respuesta);
      if (gasto === undefined) return respuesta;
      const resultado = await gastos.cargar(contextoDe(pedido), gasto);
      // El gasto repetido (misma clave) responde 200: no se creó nada nuevo.
      return enviar(respuesta, resultado, resultado.ok && resultado.valor.repetido ? 200 : 201);
    });

    app.post(
      "/gastos/:id/anulacion",
      { config: { permiso: "gastos.anular" } },
      async (pedido, respuesta) => {
        const gasto = leer(conId, pedido.params, respuesta);
        const datos = gasto && leer(pedidoDeAnulacion, pedido.body, respuesta);
        if (gasto === undefined || datos === undefined) return respuesta;
        const resultado = await gastos.anular(contextoDe(pedido), {
          id: gasto.id,
          motivo: datos.motivo,
        });
        return enviar(respuesta, resultado, 204);
      },
    );

    app.get("/gastos", { config: { permiso: "gastos.ver" } }, async (pedido, respuesta) => {
      const filtro = leer(pedidoDeGastos, pedido.query, respuesta);
      if (filtro === undefined) return respuesta;
      return enviar(respuesta, await gastos.delPeriodo(contextoDe(pedido), filtro), 200);
    });
    listo();
  };
}
