// Cookie de sesión y contexto del pedido (ver docs/decisiones/0017). Sin base.
import { id, type ContextoCentro } from "@app/nucleo";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  borrarCookieDeSesion,
  contextoDe,
  fijarCookieDeSesion,
  tokenDelPedido,
} from "../src/index.ts";

function app() {
  const servidor = Fastify();
  servidor.get("/token", (pedido) => ({ token: tokenDelPedido(pedido) ?? null }));
  servidor.get("/fijar", (_pedido, respuesta) => {
    fijarCookieDeSesion(respuesta, "abc");
    return "ok";
  });
  servidor.get("/borrar", (_pedido, respuesta) => {
    borrarCookieDeSesion(respuesta);
    return "ok";
  });
  return servidor;
}

describe("cookie de sesión", () => {
  it("es httpOnly, Secure y SameSite=Lax, y dura como máximo 7 días", async () => {
    const respuesta = await app().inject({ url: "/fijar" });
    expect(respuesta.headers["set-cookie"]).toBe(
      "__Host-sesion=abc; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("al salir se borra", async () => {
    const respuesta = await app().inject({ url: "/borrar" });
    expect(respuesta.headers["set-cookie"]).toBe(
      "__Host-sesion=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("lee el token entre otras cookies", async () => {
    const respuesta = await app().inject({
      url: "/token",
      headers: { cookie: "tema=oscuro; __Host-sesion=xyz_-1; otra=1" },
    });
    expect(respuesta.json()).toEqual({ token: "xyz_-1" });
  });

  it("sin cookie, o con otra que solo se le parece, no hay token", async () => {
    const sinCookie = await app().inject({ url: "/token" });
    expect(sinCookie.json()).toEqual({ token: null });
    const parecida = await app().inject({ url: "/token", headers: { cookie: "x__Host-sesion=a" } });
    expect(parecida.json()).toEqual({ token: null });
  });
});

describe("contextoDe", () => {
  const contexto: ContextoCentro = {
    centroId: id("centro"),
    actor: { tipo: "usuario", usuarioId: id("usuario") },
    permisosPorSede: new Map(),
  };

  it("devuelve el contexto del centro activo de la sesión", async () => {
    const servidor = Fastify();
    servidor.addHook("onRequest", (pedido, _respuesta, listo) => {
      pedido.sesion = {
        sesionId: "s",
        cuentaId: "c",
        debeCambiarClave: false,
        centro: { contexto, sedeActiva: "todas", sedes: [], sedeCambiada: false },
      };
      listo();
    });
    servidor.get("/", (pedido) => ({ centro: contextoDe(pedido).centroId }));
    expect((await servidor.inject({ url: "/" })).json()).toEqual({ centro: "centro" });
  });

  it("sin centro activo es un error del programa: la ruta tenía que exigir un permiso", async () => {
    const servidor = Fastify();
    servidor.get("/", (pedido) => contextoDe(pedido));
    expect((await servidor.inject({ url: "/" })).statusCode).toBe(500);
  });
});
