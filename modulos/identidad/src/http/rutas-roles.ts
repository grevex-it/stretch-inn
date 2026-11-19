// Rutas de roles a medida, asignaciones por sede y ajustes (ver docs/decisiones/0007). Solo
// traducen HTTP ↔ Roles: la API ya resolvió la sesión y exigió el permiso en alguna sede; las
// reglas finas (en qué sede, a quién, qué se da) las aplica el módulo.
import { edicionDeRol, pedidoDeAjuste, pedidoDeAsignacion, pedidoDeRol } from "@app/contratos";
import type { Resultado } from "@app/nucleo";
import { contextoDe } from "@app/plataforma";
import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from "fastify";
import { z } from "zod";
import type { ErrorDeRoles, Roles } from "../aplicacion/puertos-roles.ts";
import { leer, responder } from "./comun.ts";

const ver = { permiso: "usuarios.ver" } as const;
const gestionarUsuarios = { permiso: "usuarios.gestionar" } as const;
const gestionarRoles = { permiso: "roles.gestionar" } as const;

const conRol = z.object({ id: z.uuid("Ese rol no existe.") });
const conUsuario = z.object({ id: z.uuid("Esa persona no existe.") });
const conAsignacion = conUsuario.extend({ sedeId: z.uuid(), rolId: z.uuid() });
const conAjuste = conUsuario.extend({ sedeId: z.uuid(), permiso: pedidoDeAjuste.shape.permiso });

const ESTADOS: Record<ErrorDeRoles, number> = {
  "nombre-vacio": 400,
  "permiso-inexistente": 400,
  "permisos-ajenos": 403,
  "a-vos-mismo": 403,
  "mas-permisos": 403,
  "sin-gestion-en-la-sede": 403,
  "persona-protegida": 403,
  "rol-inexistente": 404,
  "usuario-inexistente": 404,
  "asignacion-inexistente": 404,
  "ajuste-inexistente": 404,
  "nombre-repetido": 409,
  "rol-de-plantilla": 409,
  "rol-en-uso": 409,
  "cambio-concurrente": 409,
  "ultimo-acceso-total": 409,
};

/** Responde el valor con ese estado, o la falla con el suyo. */
function enviar<T>(
  respuesta: FastifyReply,
  resultado: Resultado<T, ErrorDeRoles>,
  estado: number,
): FastifyReply {
  if (!resultado.ok) return responder(respuesta, ESTADOS[resultado.error.codigo], resultado.error);
  return estado === 204 ? respuesta.code(204).send() : respuesta.code(estado).send(resultado.valor);
}

function rutasDeLosRoles(app: FastifyInstance, roles: Roles): void {
  app.get("/equipo/catalogo", { config: ver }, () => ({ secciones: roles.catalogo() }));

  app.get("/equipo/roles/:id", { config: gestionarRoles }, async (pedido, respuesta) => {
    const rol = leer(conRol, pedido.params, respuesta);
    if (rol === undefined) return respuesta;
    return enviar(respuesta, await roles.rol(contextoDe(pedido), rol.id), 200);
  });

  app.post("/equipo/roles", { config: gestionarRoles }, async (pedido, respuesta) => {
    const datos = leer(pedidoDeRol, pedido.body, respuesta);
    if (datos === undefined) return respuesta;
    return enviar(respuesta, await roles.crearRol(contextoDe(pedido), datos), 201);
  });

  app.put("/equipo/roles/:id", { config: gestionarRoles }, async (pedido, respuesta) => {
    const rol = leer(conRol, pedido.params, respuesta);
    const cambio = rol && leer(edicionDeRol, pedido.body, respuesta);
    if (rol === undefined || cambio === undefined) return respuesta;
    const editado = await roles.editarRol(contextoDe(pedido), { ...cambio, id: rol.id });
    return enviar(respuesta, editado, 200);
  });

  app.delete("/equipo/roles/:id", { config: gestionarRoles }, async (pedido, respuesta) => {
    const rol = leer(conRol, pedido.params, respuesta);
    if (rol === undefined) return respuesta;
    return enviar(respuesta, await roles.borrarRol(contextoDe(pedido), rol.id), 204);
  });
}

function rutasDeAsignaciones(app: FastifyInstance, roles: Roles): void {
  app.get("/equipo/:id/permisos", { config: ver }, async (pedido, respuesta) => {
    const usuario = leer(conUsuario, pedido.params, respuesta);
    if (usuario === undefined) return respuesta;
    return enviar(respuesta, await roles.permisosDe(contextoDe(pedido), usuario.id), 200);
  });

  app.post("/equipo/:id/asignaciones", { config: gestionarUsuarios }, async (pedido, respuesta) => {
    const usuario = leer(conUsuario, pedido.params, respuesta);
    const asignacion = usuario && leer(pedidoDeAsignacion, pedido.body, respuesta);
    if (usuario === undefined || asignacion === undefined) return respuesta;
    const hecho = await roles.asignar(contextoDe(pedido), usuario.id, asignacion);
    return enviar(respuesta, hecho, 204);
  });

  app.delete(
    "/equipo/:id/asignaciones/:sedeId/:rolId",
    { config: gestionarUsuarios },
    async (pedido, respuesta) => {
      const datos = leer(conAsignacion, pedido.params, respuesta);
      if (datos === undefined) return respuesta;
      const { id, ...asignacion } = datos;
      return enviar(
        respuesta,
        await roles.quitarAsignacion(contextoDe(pedido), id, asignacion),
        204,
      );
    },
  );
}

function rutasDeAjustes(app: FastifyInstance, roles: Roles): void {
  app.put("/equipo/:id/ajustes", { config: gestionarUsuarios }, async (pedido, respuesta) => {
    const usuario = leer(conUsuario, pedido.params, respuesta);
    const ajuste = usuario && leer(pedidoDeAjuste, pedido.body, respuesta);
    if (usuario === undefined || ajuste === undefined) return respuesta;
    return enviar(respuesta, await roles.ajustar(contextoDe(pedido), usuario.id, ajuste), 204);
  });

  app.delete(
    "/equipo/:id/ajustes/:sedeId/:permiso",
    { config: gestionarUsuarios },
    async (pedido, respuesta) => {
      const datos = leer(conAjuste, pedido.params, respuesta);
      if (datos === undefined) return respuesta;
      const { id, ...ajuste } = datos;
      return enviar(respuesta, await roles.quitarAjuste(contextoDe(pedido), id, ajuste), 204);
    },
  );
}

export function rutasDeRoles(roles: Roles): FastifyPluginCallback {
  return (app, _opciones, listo) => {
    rutasDeLosRoles(app, roles);
    rutasDeAsignaciones(app, roles);
    rutasDeAjustes(app, roles);
    listo();
  };
}
