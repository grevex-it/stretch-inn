// Rutas de login y sesión (ver docs/decisiones/0017). Solo traducen HTTP ↔ Acceso: la sesión ya
// la resolvió la API antes de llegar acá.
import {
  pedidoDeCambioDeClave,
  pedidoDeCentro,
  pedidoDeIngreso,
  pedidoDeSede,
  type EstadoDeSesion,
} from "@app/contratos";
import { id } from "@app/nucleo";
import { borrarCookieDeSesion, fijarCookieDeSesion, sesionDe } from "@app/plataforma";
import type { FastifyPluginCallback } from "fastify";
import type { Acceso, SesionResuelta } from "../aplicacion/puertos-acceso.ts";
import { leer, responder } from "./comun.ts";

const conSesion = { soloSesion: true } as const;
const aunConClaveTemporal = { soloSesion: true, aunConClaveTemporal: true } as const;

/** Los permisos en alguna sede del contexto, para mostrar u ocultar en pantalla (solo UX). */
function permisosDelContexto(porSede: ReadonlyMap<unknown, ReadonlySet<string>>): string[] {
  return [...new Set([...porSede.values()].flatMap((permisos) => [...permisos]))].sort();
}

async function estado(acceso: Acceso, sesion: SesionResuelta): Promise<EstadoDeSesion> {
  const centro = sesion.centro;
  const [centros, sedes] = await Promise.all([acceso.centros(sesion), acceso.sedes(sesion)]);
  const activo = centros.find((c) => c.id === centro?.contexto.centroId);
  return {
    debeCambiarClave: sesion.debeCambiarClave,
    centros,
    centroActivo:
      centro === null || activo === undefined
        ? null
        : {
            id: activo.id,
            nombre: activo.nombre,
            sedeActiva: centro.sedeActiva,
            sedes,
            sedeCambiada: centro.sedeCambiada,
            permisos: permisosDelContexto(centro.contexto.permisosPorSede),
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
