// Rutas /profesores. El permiso en la sede (o en alguna, para lo de todo el centro) lo controla el
// módulo (0007).
import {
  pedidoDePagina,
  pedidoDeTarifa,
  pedidoDeTarifas,
  pedidoDeTipoDeProfe,
} from "@app/contratos";
import type { Resultado } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback, FastifyReply } from "fastify";
import { z } from "zod";
import type { ErrorDeProfesores, Profesores } from "../aplicacion/puertos.ts";

const ESTADOS: Record<ErrorDeProfesores, number> = {
  "monto-invalido": 400,
  "desde-invalido": 400,
  "desde-pasado": 400,
  "desde-pisa-la-anterior": 409,
  "tipo-invalido": 400,
  "profe-invalido": 400,
  "sin-permiso": 403,
};

const ver = { permiso: "profesores.ver" } as const;
const configurar = { permiso: "profesores.configurar" } as const;
const conId = z.object({ id: z.uuid("Ese profe no existe.") });

function leer<T>(esquema: z.ZodType<T>, dato: unknown, respuesta: FastifyReply): T | undefined {
  const resultado = esquema.safeParse(dato);
  if (resultado.success) return resultado.data;
  const mensaje = resultado.error.issues[0]?.message ?? "Revisá los datos.";
  void respuesta.code(400).send({ error: { codigo: "pedido-invalido", mensaje } });
  return undefined;
}

function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeProfesores>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) {
    return respuesta.code(ESTADOS[resultado.error.codigo]).send({ error: resultado.error });
  }
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}

export function rutasDeProfesores(profesores: Profesores): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    app.get("/profesores", { config: ver }, async (pedido, respuesta) => {
      const pagina = leer(pedidoDePagina, pedido.query, respuesta);
      if (pagina === undefined) return respuesta;
      return enviar(respuesta, await profesores.profes(contextoDe(pedido), pagina), 200);
    });

    app.put("/profesores/:id/tipo", { config: configurar }, async (pedido, respuesta) => {
      const profe = leer(conId, pedido.params, respuesta);
      const cambio = profe && leer(pedidoDeTipoDeProfe, pedido.body, respuesta);
      if (profe === undefined || cambio === undefined) return respuesta;
      const resultado = await profesores.fijarTipo(contextoDe(pedido), {
        profeId: profe.id,
        ...cambio,
      });
      return enviar(respuesta, resultado, 204);
    });

    app.get("/profesores/tarifas", { config: ver }, async (pedido, respuesta) => {
      const filtro = leer(pedidoDeTarifas, pedido.query, respuesta);
      if (filtro === undefined) return respuesta;
      return enviar(respuesta, await profesores.tarifas(contextoDe(pedido), filtro), 200);
    });

    app.post("/profesores/tarifas", { config: configurar }, async (pedido, respuesta) => {
      const tarifa = leer(pedidoDeTarifa, pedido.body, respuesta);
      if (tarifa === undefined) return respuesta;
      return enviar(respuesta, await profesores.fijarTarifa(contextoDe(pedido), tarifa), 204);
    });
    listo();
  };
}
