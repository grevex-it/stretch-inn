// Traducción común de las rutas: validar lo que llega y responder resultados y fallas.
import type { Resultado } from "@app/nucleo";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import type { ErrorDeAsistencia } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeAsistencia, number> = {
  "marcas-vacias": 400,
  "marcas-repetidas": 400,
  "demasiadas-marcas": 400,
  "sin-permiso": 403,
  "fecha-inexistente": 404,
  "fecha-cancelada": 409,
  "todavia-no-empieza": 409,
  "no-inscripto": 409,
};

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
  resultado: Resultado<T, ErrorDeAsistencia>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}
