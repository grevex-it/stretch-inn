// Cliente de la API del panel: único lugar que hace fetch (ver AGENTS.md de apps/web).
import { estadoDeSesion } from "@app/contratos";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { consultar, enviar, enviarYLeer, ErrorDeApi } from "../src/base/api.ts";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const estado = { debeCambiarClave: false, centros: [], centroActivo: null };

describe("consultar", () => {
  it("pide a /api con la cookie y valida la respuesta con el contrato", async () => {
    const { pedidos } = servidorFalso({ "GET /api/sesion": { estado: 200, cuerpo: estado } });
    await expect(consultar("/sesion", estadoDeSesion)).resolves.toEqual(estado);
    expect(pedidos[0]?.init?.credentials).toBe("same-origin");
  });

  it("una respuesta que no cumple el contrato es un error, no un dato a medias", async () => {
    servidorFalso({ "GET /api/sesion": { estado: 200, cuerpo: { otra: "cosa" } } });
    await expect(consultar("/sesion", estadoDeSesion)).rejects.toMatchObject({
      codigo: "respuesta-invalida",
    });
  });

  it("un error de la API llega con su código y su mensaje para el usuario", async () => {
    servidorFalso({
      "GET /api/sesion": {
        estado: 401,
        cuerpo: { error: { codigo: "sin-sesion", mensaje: "Tu sesión terminó." } },
      },
    });
    const error = await consultar("/sesion", estadoDeSesion).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeApi);
    expect(error).toMatchObject({
      estado: 401,
      codigo: "sin-sesion",
      message: "Tu sesión terminó.",
    });
  });

  it("sin conexión avisa en palabras simples", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(consultar("/sesion", estadoDeSesion)).rejects.toMatchObject({
      codigo: "sin-conexion",
      message: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.",
    });
  });
});

describe("enviar", () => {
  it("manda JSON con el método pedido y acepta un 204 sin cuerpo", async () => {
    const { pedidos } = servidorFalso({ "PUT /api/sesion/sede": { estado: 204 } });
    await expect(enviar("PUT", "/sesion/sede", { sede: "todas" })).resolves.toBeUndefined();
    expect(pedidos[0]).toMatchObject({ clave: "PUT /api/sesion/sede", cuerpo: { sede: "todas" } });
    expect(new Headers(pedidos[0]?.init?.headers).get("content-type")).toBe("application/json");
  });
});

describe("enviarYLeer", () => {
  const esquema = z.object({ claveTemporal: z.string() });

  it("devuelve la respuesta validada con el contrato", async () => {
    servidorFalso({ "POST /api/x": { estado: 200, cuerpo: { claveTemporal: "abcd" } } });
    await expect(enviarYLeer("POST", "/x", esquema)).resolves.toEqual({ claveTemporal: "abcd" });
  });

  it("una respuesta que no cumple el contrato es un error", async () => {
    servidorFalso({ "POST /api/x": { estado: 200, cuerpo: { otra: 1 } } });
    await expect(enviarYLeer("POST", "/x", esquema)).rejects.toMatchObject({
      codigo: "respuesta-invalida",
    });
  });
});
