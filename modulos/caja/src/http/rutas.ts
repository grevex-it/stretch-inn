// Rutas /caja. El permiso en la sede del pago lo controla el módulo (0007).
import { pedidoDeAnulacion, pedidoDeCobro, pedidoDelDia } from "@app/contratos";
import type { Resultado } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import { z } from "zod";
import type { Caja, ErrorDeCaja } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeCaja, number> = {
  "clave-invalida": 400,
  "motivo-vacio": 400,
  "medio-invalido": 400,
  "dia-invalido": 400,
  "sin-permiso": 403,
  "cuota-inexistente": 404,
  "pago-inexistente": 404,
  "cuota-pagada": 409,
  "clave-usada": 409,
  "pago-anulado": 409,
};

const conId = z.object({ id: z.uuid("Ese pago no existe.") });

function leer<T>(esquema: z.ZodType<T>, dato: unknown, respuesta: FastifyReply): T | undefined {
  const resultado = esquema.safeParse(dato);
  if (resultado.success) return resultado.data;
  const mensaje = resultado.error.issues[0]?.message ?? "Revisá los datos.";
  void respuesta.code(400).send({ error: { codigo: "pedido-invalido", mensaje } });
  return undefined;
}

function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeCaja>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}

export function rutasDeCaja(caja: Caja): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    app.post("/caja/cobros", { config: { permiso: "caja.cobrar" } }, async (pedido, respuesta) => {
      const cobro = leer(pedidoDeCobro, pedido.body, respuesta);
      if (cobro === undefined) return respuesta;
      const resultado = await caja.cobrarCuota(contextoDe(pedido), cobro);
      // El cobro repetido (misma clave) responde 200: no se creó nada nuevo.
      return enviar(respuesta, resultado, resultado.ok && resultado.valor.repetido ? 200 : 201);
    });

    app.post(
      "/caja/pagos/:id/anulacion",
      { config: { permiso: "caja.anular" } },
      async (pedido, respuesta) => {
        const pago = leer(conId, pedido.params, respuesta);
        const datos = pago && leer(pedidoDeAnulacion, pedido.body, respuesta);
        if (pago === undefined || datos === undefined) return respuesta;
        const resultado = await caja.anular(contextoDe(pedido), {
          id: pago.id,
          motivo: datos.motivo,
        });
        return enviar(respuesta, resultado, 204);
      },
    );

    app.get("/caja/pagos", { config: { permiso: "caja.ver" } }, async (pedido, respuesta) => {
      const filtro = leer(pedidoDelDia, pedido.query, respuesta);
      if (filtro === undefined) return respuesta;
      return enviar(respuesta, await caja.delDia(contextoDe(pedido), filtro), 200);
    });
    listo();
  };
}
