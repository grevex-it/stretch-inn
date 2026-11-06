// La API resuelve la sesión de cada pedido y exige lo que declara la ruta (0007 y 0017).
import { describe, expect, it } from "vitest";
import type { SesionDelPedido } from "@app/plataforma";
import { appDePrueba, conCookie, PANEL, sesionCon } from "./ayudas.ts";

function conRutas(sesiones: Record<string, SesionDelPedido> = {}) {
  const prueba = appDePrueba({ sesiones });
  const { app } = prueba;
  app.get("/caja", { config: { permiso: "caja.ver" } }, () => ({ ok: true }));
  app.post("/caja", { config: { permiso: "caja.ver" } }, () => ({ ok: true }));
  app.get("/centros", { config: { soloSesion: true } }, () => ({ ok: true }));
  app.put("/clave", { config: { soloSesion: true, aunConClaveTemporal: true } }, () => ({
    ok: true,
  }));
  app.post("/entrar", { config: { publica: true } }, () => ({ ok: true }));
  return prueba;
}

const error = (codigo: string) => ({ error: expect.objectContaining({ codigo }) as unknown });

describe("sesión", () => {
  it("sin cookie, una ruta con permiso responde 401", async () => {
    const respuesta = await conRutas().app.inject({ url: "/caja" });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(error("sin-sesion"));
  });

  it("con una cookie que no resuelve sesión (vencida o revocada) también 401", async () => {
    const { app, tokensPedidos } = conRutas();
    const respuesta = await app.inject({ url: "/caja", headers: conCookie("viejo") });
    expect(respuesta.statusCode).toBe(401);
    expect(tokensPedidos).toEqual(["viejo"]);
  });

  it("con el permiso en alguna sede del contexto, pasa", async () => {
    const { app } = conRutas({ t: sesionCon(["caja.ver"]) });
    const respuesta = await app.inject({ url: "/caja", headers: conCookie("t") });
    expect(respuesta.statusCode).toBe(200);
  });

  it("sin el permiso responde 403", async () => {
    const { app } = conRutas({ t: sesionCon(["agenda.ver"]) });
    const respuesta = await app.inject({ url: "/caja", headers: conCookie("t") });
    expect(respuesta.statusCode).toBe(403);
    expect(respuesta.json()).toEqual(error("sin-permiso"));
  });

  it("sin centro elegido, una ruta con permiso responde 403; una de solo sesión pasa", async () => {
    const { app } = conRutas({ t: sesionCon(null) });
    const caja = await app.inject({ url: "/caja", headers: conCookie("t") });
    expect(caja.statusCode).toBe(403);
    expect(caja.json()).toEqual(error("sin-centro"));
    const centros = await app.inject({ url: "/centros", headers: conCookie("t") });
    expect(centros.statusCode).toBe(200);
  });

  it("con la clave temporal solo puede usar las rutas que lo permiten", async () => {
    const { app } = conRutas({ t: sesionCon(["caja.ver"], { debeCambiarClave: true }) });
    const caja = await app.inject({ url: "/caja", headers: conCookie("t") });
    expect(caja.statusCode).toBe(403);
    expect(caja.json()).toEqual(error("debe-cambiar-clave"));
    const clave = await app.inject({
      method: "PUT",
      url: "/clave",
      headers: { ...conCookie("t"), origin: PANEL },
    });
    expect(clave.statusCode).toBe(200);
  });

  it("una ruta pública no busca sesión", async () => {
    const { app, tokensPedidos } = conRutas();
    const respuesta = await app.inject({
      method: "POST",
      url: "/entrar",
      headers: { origin: PANEL },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(tokensPedidos).toEqual([]);
  });
});

describe("Origin en los pedidos que cambian datos", () => {
  it("rechaza un POST desde otro sitio, aunque la ruta sea pública", async () => {
    const { app } = conRutas();
    const respuesta = await app.inject({
      method: "POST",
      url: "/entrar",
      headers: { origin: "https://otro.com" },
    });
    expect(respuesta.statusCode).toBe(403);
    expect(respuesta.json()).toEqual(error("origen-invalido"));
  });

  it("rechaza un POST sin Origin", async () => {
    const { app } = conRutas({ t: sesionCon(["caja.ver"]) });
    const respuesta = await app.inject({ method: "POST", url: "/caja", headers: conCookie("t") });
    expect(respuesta.statusCode).toBe(403);
  });

  it("acepta un POST desde el panel y un GET sin Origin", async () => {
    const { app } = conRutas({ t: sesionCon(["caja.ver"]) });
    const post = await app.inject({
      method: "POST",
      url: "/caja",
      headers: { ...conCookie("t"), origin: PANEL },
    });
    expect(post.statusCode).toBe(200);
    const get = await app.inject({ url: "/caja", headers: conCookie("t") });
    expect(get.statusCode).toBe(200);
  });
});

describe("declaración de la ruta", () => {
  it("soloSesion cuenta como declaración", async () => {
    const { app } = appDePrueba();
    app.get("/yo", { config: { soloSesion: true } }, () => "ok");
    await expect(app.ready()).resolves.toBeDefined();
  });

  it("una ruta que no existe sigue respondiendo 404, sin pedir sesión", async () => {
    const respuesta = await appDePrueba().app.inject({ url: "/no-existe" });
    expect(respuesta.statusCode).toBe(404);
  });
});

describe("IP del pedido (límite de intentos de login)", () => {
  function conIp(detrasDeProxy: boolean) {
    const { app } = appDePrueba({ detrasDeProxy });
    app.get("/ip", { config: { publica: true } }, (pedido) => ({ ip: pedido.ip }));
    return app;
  }

  it("detrás del proxy usa la IP que agregó el proxy, no la que inventa el cliente", async () => {
    const respuesta = await conIp(true).inject({
      url: "/ip",
      remoteAddress: "10.0.0.1",
      headers: { "x-forwarded-for": "6.6.6.6, 200.1.2.3" },
    });
    expect(respuesta.json()).toEqual({ ip: "200.1.2.3" });
  });

  it("sin proxy ignora X-Forwarded-For", async () => {
    const respuesta = await conIp(false).inject({
      url: "/ip",
      remoteAddress: "200.1.2.3",
      headers: { "x-forwarded-for": "6.6.6.6" },
    });
    expect(respuesta.json()).toEqual({ ip: "200.1.2.3" });
  });
});
