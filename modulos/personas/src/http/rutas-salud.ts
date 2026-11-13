// Rutas de los datos de salud del alumno, con permisos propios (0019): los ve quien tiene
// `personas.ver-salud`, no cualquiera que vea la ficha.
import { saludDeAlumno } from "@app/contratos";
import type { Transaccion } from "@app/plataforma";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { fijarSalud, obtenerSalud } from "../datos/salud.ts";
import { enviar, leer } from "./traducir.ts";

const conId = z.object({ id: z.uuid("Ese alumno no existe.") });

type EnElCentro = <T>(
  pedido: FastifyRequest,
  trabajo: (tx: Transaccion) => Promise<T>,
) => Promise<T>;

export function rutasDeSalud(app: FastifyInstance, enElCentro: EnElCentro): void {
  const url = "/alumnos/:id/salud";
  app.get(url, { config: { permiso: "personas.ver-salud" } }, async (pedido, respuesta) => {
    const alumno = leer(conId, pedido.params, respuesta);
    if (alumno === undefined) return respuesta;
    return enviar(respuesta, await enElCentro(pedido, (tx) => obtenerSalud(tx, alumno.id)), 200);
  });

  app.put(url, { config: { permiso: "personas.editar-salud" } }, async (pedido, respuesta) => {
    const alumno = leer(conId, pedido.params, respuesta);
    const cambio = alumno && leer(saludDeAlumno, pedido.body, respuesta);
    if (alumno === undefined || cambio === undefined) return respuesta;
    const resultado = await enElCentro(pedido, (tx) =>
      fijarSalud(tx, { ...cambio, alumnoId: alumno.id }),
    );
    return enviar(respuesta, resultado, 200);
  });
}
