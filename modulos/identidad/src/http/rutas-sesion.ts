// Rutas de login y sesión (ver docs/decisiones/0017). Solo traducen HTTP ↔ Acceso: la sesión ya
// la resolvió la API antes de llegar acá.
import {
  pedidoDeCambioDeClave,
  pedidoDeCentro,
  pedidoDeIngreso,
  pedidoDeSede,
  type EstadoDeSesion,
} from "@app/contratos";
import { id, type Falla } from "@app/nucleo";
import { borrarCookieDeSesion, fijarCookieDeSesion, sesionDe } from "@app/plataforma";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import type { z } from "zod";
import type { Acceso, SesionResuelta } from "../aplicacion/puertos-acceso.ts";

const conSesion = { soloSesion: true } as const;
const aunConClaveTemporal = { soloSesion: true, aunConClaveTemporal: true } as const;

/** El cuerpo validado, o undefined si ya se respondió 400. */
function leer<T>(esquema: z.ZodType<T>, cuerpo: unknown, respuesta: FastifyReply): T | undefined {
  const resultado = esquema.safeParse(cuerpo);
  if (resultado.success) return resultado.data;
  const mensaje = resultado.error.issues[0]?.message ?? "Revisá los datos.";
  void respuesta.code(400).send({ error: { codigo: "pedido-invalido", mensaje } });
  return undefined;
}

function responder(respuesta: FastifyReply, estado: number, error: Falla) {
  return respuesta.code(estado).send({ error });
}

async function estado(acceso: Acceso, sesion: SesionResuelta): Promise<EstadoDeSesion> {
  const centro = sesion.centro;
  return {
    debeCambiarClave: sesion.debeCambiarClave,
    centros: await acceso.centros(sesion),
    centroActivo:
      centro === null
        ? null
        : {
            id: centro.contexto.centroId,
            sedeActiva: centro.sedeActiva,
            sedes: centro.sedes,
            sedeCambiada: centro.sedeCambiada,
          },
  };
}

export function rutasDeSesion(acceso: Acceso): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    app.post("/sesion", { config: { publica: true } }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeIngreso, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      const ingreso = await acceso.entrar({ ...datos, origen: pedido.ip });
      if (!ingreso.ok) return responder(respuesta, 401, ingreso.error);
      fijarCookieDeSesion(respuesta, ingreso.valor.token);
      const { debeCambiarClave, centros } = ingreso.valor;
      return { debeCambiarClave, centros };
    });

    app.get("/sesion", { config: aunConClaveTemporal }, (pedido) =>
      estado(acceso, sesionDe(pedido)),
    );

    app.delete("/sesion", { config: aunConClaveTemporal }, async (pedido, respuesta) => {
      await acceso.salir(sesionDe(pedido));
      borrarCookieDeSesion(respuesta);
      return respuesta.code(204).send();
    });

    app.put("/sesion/clave", { config: aunConClaveTemporal }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeCambioDeClave, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      const cambio = await acceso.cambiarClave(sesionDe(pedido), datos);
      if (!cambio.ok) return responder(respuesta, 400, cambio.error);
      return respuesta.code(204).send();
    });

    app.put("/sesion/centro", { config: conSesion }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeCentro, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      const eleccion = await acceso.elegirCentro(sesionDe(pedido), datos.centroId);
      if (!eleccion.ok) return responder(respuesta, 403, eleccion.error);
      return respuesta.code(204).send();
    });

    app.put("/sesion/sede", { config: conSesion }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeSede, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      const sede = datos.sede === "todas" ? "todas" : id<"Sede">(datos.sede);
      const eleccion = await acceso.elegirSede(sesionDe(pedido), sede);
      if (!eleccion.ok) return responder(respuesta, 403, eleccion.error);
      return respuesta.code(204).send();
    });
    listo();
  };
}
