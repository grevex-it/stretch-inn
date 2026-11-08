// Rutas de los planes y sus precios por sede.
import { edicionDePlan, fichaDePlan, pedidoDePagina, pedidoDePrecioDeSede } from "@app/contratos";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Abonos } from "../aplicacion/puertos.ts";
import { conId, enviar, leer } from "./comun.ts";

const ver = { permiso: "abonos.ver" } as const;
const gestionar = { permiso: "abonos.gestionar" } as const;
const planYSede = z.object({
  id: z.uuid("Ese plan no existe."),
  sedeId: z.uuid("Esa sede no existe."),
});

export function rutasDePlanes(app: FastifyInstance, abonos: Abonos): void {
  app.get("/abonos/planes", { config: ver }, async (pedido, respuesta) => {
    const pagina = leer(pedidoDePagina, pedido.query, respuesta);
    if (pagina === undefined) return respuesta;
    return enviar(respuesta, await abonos.planes(contextoDe(pedido), pagina), 200);
  });

  app.post("/abonos/planes", { config: gestionar }, async (pedido, respuesta) => {
    const datos = leer(fichaDePlan, pedido.body, respuesta);
    if (datos === undefined) return respuesta;
    return enviar(respuesta, await abonos.crearPlan(contextoDe(pedido), datos), 201);
  });

  app.put("/abonos/planes/:id", { config: gestionar }, async (pedido, respuesta) => {
    const plan = leer(conId, pedido.params, respuesta);
    const datos = plan && leer(edicionDePlan, pedido.body, respuesta);
    if (plan === undefined || datos === undefined) return respuesta;
    const resultado = await abonos.editarPlan(contextoDe(pedido), { ...datos, id: plan.id });
    return enviar(respuesta, resultado, 200);
  });

  for (const [metodo, activo] of [
    ["PUT", false],
    ["DELETE", true],
  ] as const) {
    app.route({
      method: metodo,
      url: "/abonos/planes/:id/baja",
      config: gestionar,
      handler: async (pedido, respuesta) => {
        const plan = leer(conId, pedido.params, respuesta);
        if (plan === undefined) return respuesta;
        const resultado = await abonos.fijarActivo(contextoDe(pedido), { id: plan.id, activo });
        return enviar(respuesta, resultado, 204);
      },
    });
  }

  rutasDePrecios(app, abonos);
}

function rutasDePrecios(app: FastifyInstance, abonos: Abonos): void {
  const url = "/abonos/planes/:id/sedes/:sedeId/precio";
  app.put(url, { config: gestionar }, async (pedido, respuesta) => {
    const destino = leer(planYSede, pedido.params, respuesta);
    const datos = destino && leer(pedidoDePrecioDeSede, pedido.body, respuesta);
    if (destino === undefined || datos === undefined) return respuesta;
    const resultado = await abonos.fijarPrecioDeSede(contextoDe(pedido), {
      planId: destino.id,
      sedeId: destino.sedeId,
      precio: datos.precio,
    });
    return enviar(respuesta, resultado, 204);
  });

  app.delete(url, { config: gestionar }, async (pedido, respuesta) => {
    const destino = leer(planYSede, pedido.params, respuesta);
    if (destino === undefined) return respuesta;
    const resultado = await abonos.fijarPrecioDeSede(contextoDe(pedido), {
      planId: destino.id,
      sedeId: destino.sedeId,
      precio: null,
    });
    return enviar(respuesta, resultado, 204);
  });
}
