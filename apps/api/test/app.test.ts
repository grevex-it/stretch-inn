import { codigoDeTraza } from "@app/plataforma";
import { describe, expect, it } from "vitest";
import { appDePrueba as app, conCookie, sesionCon } from "./ayudas.ts";

function appDePrueba(comprobarBase?: () => Promise<void>) {
  return app({ comprobarBase, sesiones: { t: sesionCon(["caja.ver"]) } });
}

describe("/salud", () => {
  it("responde 200 si la base contesta, con la traza del pedido en x-traza", async () => {
    const { app } = appDePrueba();
    const respuesta = await app.inject({ method: "GET", url: "/salud" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "ok" });
    expect(respuesta.headers["x-traza"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("responde 503 y registra el error si la base no contesta", async () => {
    const { app, logs } = appDePrueba(() => Promise.reject(new Error("conexión rechazada")));
    const respuesta = await app.inject({ method: "GET", url: "/salud" });
    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json()).toEqual({ estado: "sin-base" });
    expect(logs()).toContainEqual(expect.objectContaining({ level: "error" }));
  });
});

describe("rutas", () => {
  it("una ruta que no declara permiso se rechaza al registrarla: la app no arranca (0007)", () => {
    const { app } = appDePrueba();
    expect(() => app.get("/sin-permiso", () => "hola")).toThrow(
      /GET \/sin-permiso no declara permiso/,
    );
  });

  it("acepta una ruta con permiso declarado o marcada como pública", async () => {
    const { app } = appDePrueba();
    app.get("/caja", { config: { permiso: "caja.ver" } }, () => "ok");
    app.get("/publica", { config: { publica: true } }, () => "ok");
    await expect(app.ready()).resolves.toBeDefined();
  });

  it("responde 404 en JSON a una ruta que no existe", async () => {
    const { app } = appDePrueba();
    const respuesta = await app.inject({ method: "GET", url: "/no-existe" });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({
      error: { codigo: "no-encontrado", mensaje: "No existe GET /no-existe." },
    });
  });
});

describe("errores no previstos (0016)", () => {
  it("el usuario ve solo un código; el log guarda la traza y la pila", async () => {
    const { app, logs } = appDePrueba();
    app.get("/rompe", { config: { permiso: "caja.ver" } }, () => {
      throw new Error("se cortó la conexión");
    });
    const respuesta = await app.inject({ method: "GET", url: "/rompe", headers: conCookie("t") });
    const traza = String(respuesta.headers["x-traza"]);

    expect(respuesta.statusCode).toBe(500);
    expect(respuesta.json()).toEqual({
      error: { codigo: "error-interno", mensaje: `Algo falló. Código: ${codigoDeTraza(traza)}` },
    });
    expect(respuesta.body).not.toContain("se cortó la conexión");
    expect(logs()).toContainEqual(
      expect.objectContaining({
        level: "error",
        traza,
        err: expect.objectContaining({ message: "se cortó la conexión" }) as unknown,
      }),
    );
  });
});
