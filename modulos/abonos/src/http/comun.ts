// Traducción común de las rutas: validar lo que llega y responder resultados y fallas.
import type { Resultado } from "@app/nucleo";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import type { ErrorDeAbonos } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeAbonos, number> = {
  "nombre-vacio": 400,
  "clases-invalidas": 400,
  "precio-invalido": 400,
  "dia-invalido": 400,
  "sin-permiso": 403,
  "plan-inexistente": 404,
  "alumno-inexistente": 404,
  "cuota-inexistente": 404,
  "plan-inactivo": 409,
  "cambio-concurrente": 409,
  "alumno-de-baja": 409,
  "ya-tiene-cuota": 409,
  "cuota-pagada": 409,
};

export const conId = z.object({ id: z.uuid("Eso no existe en los abonos.") });

/** El dato validado, o undefined si ya se respondió 400. */
export function leer<T>(
  esquema: z.ZodType<T>,
  dato: unknown,
  respuesta: FastifyReply,
): T | undefined {
  const resultado = esquema.safeParse(dato);
  if (resultado.success) return resultado.data;
  const mensaje = resultado.error.issues[0]?.message ?? "Revisá los datos.";
  void respuesta.code(400).send({ error: { codigo: "pedido-invalido", mensaje } });
  return undefined;
}

/** El valor con ese estado (204 sin cuerpo), o la falla con el suyo. */
export function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeAbonos>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}
