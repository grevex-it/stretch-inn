// Traducción común de las rutas: validar lo que llega y responder resultados y fallas.
import type { Resultado } from "@app/nucleo";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import type { ErrorDeAlumno } from "../datos/tipos.ts";

const ESTADOS: Record<ErrorDeAlumno, number> = {
  "nombre-vacio": 400,
  "telefono-invalido": 400,
  "fecha-invalida": 400,
  "documento-repetido": 409,
  "cambio-concurrente": 409,
  "alumno-inexistente": 404,
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
  resultado: Resultado<T, ErrorDeAlumno>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}
