// Rutas de las inscripciones. El permiso en la sede de la clase lo controla el módulo (0007).
import { pedidoDeInscripcion, pedidoDePagina } from "@app/contratos";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Agenda } from "../aplicacion/puertos.ts";
import { enviar, leer } from "./comun.ts";

const ver = { permiso: "agenda.ver" } as const;
const inscribir = { permiso: "agenda.inscribir" } as const;
const conId = z.object({ id: z.uuid("Eso no existe en la agenda.") });

export function rutasDeInscripciones(app: FastifyInstance, agenda: Agenda): void {
  app.post("/agenda/clases/:id/inscriptos", { config: inscribir }, async (pedido, respuesta) => {
    const clase = leer(conId, pedido.params, respuesta);
    const datos = clase && leer(pedidoDeInscripcion, pedido.body, respuesta);
    if (clase === undefined || datos === undefined) return respuesta;
    const resultado = await agenda.inscribir(contextoDe(pedido), { ...datos, claseId: clase.id });
    return enviar(respuesta, resultado, 201);
  });

  app.delete("/agenda/inscripciones/:id", { config: inscribir }, async (pedido, respuesta) => {
    const inscripcion = leer(conId, pedido.params, respuesta);
    if (inscripcion === undefined) return respuesta;
    const resultado = await agenda.darDeBajaInscripcion(contextoDe(pedido), inscripcion);
    return enviar(respuesta, resultado, 204);
  });

  // Para la ficha del alumno. Vive en agenda: personas no sabe de clases.
  app.get("/alumnos/:id/clases", { config: ver }, async (pedido, respuesta) => {
    const alumno = leer(conId, pedido.params, respuesta);
    const pagina = alumno && leer(pedidoDePagina, pedido.query, respuesta);
    if (alumno === undefined || pagina === undefined) return respuesta;
    const resultado = await agenda.clasesDeAlumno(contextoDe(pedido), {
      ...pagina,
      alumnoId: alumno.id,
    });
    return enviar(respuesta, resultado, 200);
  });
}
