// Rutas /abonos. El permiso en la sede (o en alguna sede, para los planes) lo controla el módulo.
import {
  pedidoDeAbonoDelAlumno,
  pedidoDeCuota,
  pedidoDeImpagas,
  pedidoDePagina,
} from "@app/contratos";
import { ok } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyPluginCallback } from "fastify";
import type { Abonos } from "../aplicacion/puertos.ts";
import { conId, enviar, leer } from "./comun.ts";
import { rutasDePlanes } from "./rutas-planes.ts";

const ver = { permiso: "abonos.ver" } as const;
const asignar = { permiso: "abonos.asignar" } as const;

export function rutasDeAbonos(abonos: Abonos): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    rutasDePlanes(app, abonos);

    app.post("/abonos/cuotas", { config: asignar }, async (pedido, respuesta) => {
      const datos = leer(pedidoDeCuota, pedido.body, respuesta);
      if (datos === undefined) return respuesta;
      const { desde, ...cuota } = datos;
      const resultado = await abonos.generarCuota(
        contextoDe(pedido),
        desde === undefined ? cuota : { ...cuota, desde },
      );
      return enviar(respuesta, resultado, 201);
    });

    app.get("/abonos/cuotas/impagas", { config: ver }, async (pedido, respuesta) => {
      const filtro = leer(pedidoDeImpagas, pedido.query, respuesta);
      if (filtro === undefined) return respuesta;
      return enviar(respuesta, await abonos.cuotasImpagas(contextoDe(pedido), filtro), 200);
    });

    app.delete("/abonos/cuotas/:id", { config: asignar }, async (pedido, respuesta) => {
      const cuota = leer(conId, pedido.params, respuesta);
      if (cuota === undefined) return respuesta;
      return enviar(respuesta, await abonos.anularCuota(contextoDe(pedido), cuota), 204);
    });

    // Para la ficha del alumno. Vive en abonos: personas no sabe de cuotas.
    app.get("/alumnos/:id/cuotas", { config: ver }, async (pedido, respuesta) => {
      const alumno = leer(conId, pedido.params, respuesta);
      const pagina = alumno && leer(pedidoDePagina, pedido.query, respuesta);
      if (alumno === undefined || pagina === undefined) return respuesta;
      const resultado = await abonos.cuotasDeAlumno(contextoDe(pedido), {
        ...pagina,
        alumnoId: alumno.id,
      });
      return enviar(respuesta, resultado, 200);
    });

    // Las clases que le quedan del abono: para la ficha y para el profe (sin montos).
    app.get("/alumnos/:id/abono", { config: ver }, async (pedido, respuesta) => {
      const alumno = leer(conId, pedido.params, respuesta);
      const sede = alumno && leer(pedidoDeAbonoDelAlumno, pedido.query, respuesta);
      if (alumno === undefined || sede === undefined) return respuesta;
      const resultado = await abonos.abonoDelAlumno(contextoDe(pedido), {
        alumnoId: alumno.id,
        sedeId: sede.sedeId,
      });
      return enviar(respuesta, resultado.ok ? ok({ abono: resultado.valor }) : resultado, 200);
    });
    listo();
  };
}
