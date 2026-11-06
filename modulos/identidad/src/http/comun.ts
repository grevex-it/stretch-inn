// Traducción común de las rutas del módulo: validar lo que llega y responder fallas.
import type { Falla } from "@app/nucleo";
import type { FastifyReply } from "fastify";
import type { z } from "zod";

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

export function responder(respuesta: FastifyReply, estado: number, error: Falla) {
  return respuesta.code(estado).send({ error });
}
