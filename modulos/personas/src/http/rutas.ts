// Rutas de alumnos (ver docs/decisiones/0011). Solo traducen HTTP ↔ datos del módulo: la API ya
// resolvió la sesión y exigió el permiso. Cada pedido corre en su transacción con el contexto.
import { edicionDeAlumno, fichaDeAlumno, pedidoDeAlumnos } from "@app/contratos";
import { falla, ok } from "@app/nucleo";
import { contextoDe, enContexto, type Base, type Transaccion } from "@app/plataforma";
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  crearAlumno,
  editarAlumno,
  fijarActivo,
  listarAlumnos,
  obtenerAlumno,
} from "../datos/alumnos.ts";
import { enviar, leer } from "./traducir.ts";

const ver = { permiso: "personas.ver" } as const;
const editar = { permiso: "personas.editar" } as const;
const conId = z.object({ id: z.uuid("Ese alumno no existe.") });

/** Corre el trabajo en una transacción con el contexto del pedido. */
type EnElCentro = <T>(
  pedido: FastifyRequest,
  trabajo: (tx: Transaccion) => Promise<T>,
) => Promise<T>;

function lecturas(app: FastifyInstance, enElCentro: EnElCentro): void {
  app.get("/alumnos", { config: ver }, async (pedido, respuesta) => {
    const busqueda = leer(pedidoDeAlumnos, pedido.query, respuesta);
    if (busqueda === undefined) return respuesta;
    return enElCentro(pedido, (tx) => listarAlumnos(tx, busqueda));
  });

  app.get("/alumnos/:id", { config: ver }, async (pedido, respuesta) => {
    const alumno = leer(conId, pedido.params, respuesta);
    if (alumno === undefined) return respuesta;
    const ficha = await enElCentro(pedido, (tx) => obtenerAlumno(tx, alumno.id));
    const resultado =
      ficha === undefined
        ? falla("alumno-inexistente", "Ese alumno no existe en el centro.")
        : ok(ficha);
    return enviar(respuesta, resultado, 200);
  });
}

function escrituras(app: FastifyInstance, enElCentro: EnElCentro): void {
  app.post("/alumnos", { config: editar }, async (pedido, respuesta) => {
    const ficha = leer(fichaDeAlumno, pedido.body, respuesta);
    if (ficha === undefined) return respuesta;
    return enviar(respuesta, await enElCentro(pedido, (tx) => crearAlumno(tx, ficha)), 201);
  });

  app.put("/alumnos/:id", { config: editar }, async (pedido, respuesta) => {
    const alumno = leer(conId, pedido.params, respuesta);
    const cambio = alumno && leer(edicionDeAlumno, pedido.body, respuesta);
    if (alumno === undefined || cambio === undefined) return respuesta;
    const resultado = await enElCentro(pedido, (tx) =>
      editarAlumno(tx, { ...cambio, id: alumno.id }),
    );
    return enviar(respuesta, resultado, 200);
  });

  // PUT da de baja; DELETE quita la baja (reactiva).
  for (const [metodo, activo] of [
    ["PUT", false],
    ["DELETE", true],
  ] as const) {
    app.route({
      method: metodo,
      url: "/alumnos/:id/baja",
      config: editar,
      handler: async (pedido, respuesta) => {
        const alumno = leer(conId, pedido.params, respuesta);
        if (alumno === undefined) return respuesta;
        const resultado = await enElCentro(pedido, (tx) =>
          fijarActivo(tx, { id: alumno.id, activo }),
        );
        return enviar(respuesta, resultado, 204);
      },
    });
  }
}

export function rutasDeAlumnos(base: Base): FastifyPluginCallback {
  const enElCentro: EnElCentro = (pedido, trabajo) => enContexto(base, contextoDe(pedido), trabajo);
  return (app, _opciones, listo) => {
    lecturas(app, enElCentro);
    escrituras(app, enElCentro);
    listo();
  };
}
