// Traducción común de las rutas: validar lo que llega y responder resultados y fallas.
import type { Resultado } from "@app/nucleo";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import type { ErrorDeAgenda } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeAgenda, number> = {
  "nombre-vacio": 400,
  "dia-invalido": 400,
  "hora-invalida": 400,
  "duracion-invalida": 400,
  "cupo-invalido": 400,
  "profe-invalido": 400,
  "periodo-invalido": 400,
  "camas-invalidas": 400,
  "sin-permiso": 403,
  "clase-inexistente": 404,
  "fecha-inexistente": 404,
  "alumno-inexistente": 404,
  "inscripcion-inexistente": 404,
  "fecha-pasada": 409,
  "cambio-concurrente": 409,
  "clase-completa": 409,
  "clase-inactiva": 409,
  "alumno-de-baja": 409,
  "ya-inscripto": 409,
  "cupo-menor-que-inscriptos": 409,
  "fecha-completa": 409,
  "cupo-mayor-que-camas": 409,
  "camas-menos-que-inscriptos": 409,
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
  resultado: Resultado<T, ErrorDeAgenda>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}
