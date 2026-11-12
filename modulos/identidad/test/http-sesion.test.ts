// Rutas de sesión (0017): traducen HTTP ↔ Acceso. El comportamiento del login lo prueban los
// tests de integración; acá, con un Acceso doble, se prueba la traducción.
import { falla, id, ok } from "@app/nucleo";
import type { SesionDelPedido } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { rutasDeSesion, type Acceso } from "../src/index.ts";

const SEDE = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
const sesion: SesionDelPedido = {
  sesionId: "s-1",
  cuentaId: "c-1",
  debeCambiarClave: false,
  centro: {
    contexto: {
      centroId: id(SEDE),
      actor: { tipo: "usuario", usuarioId: id("u-1") },
      permisosPorSede: new Map([
        [id(SEDE), new Set(["usuarios.ver", "caja.ver"] as const)],
        [id("otra-sede"), new Set(["caja.ver"] as const)],
      ]),
    },
    sedeActiva: "todas",
    sedes: [id(SEDE)],
    sedeCambiada: false,
  },
};

/** Un Acceso hecho de espías: cada método es un vi.fn que se puede reprogramar. */
function accesoDoble() {
  return {
    entrar: vi.fn<Acceso["entrar"]>(() =>
      Promise.resolve(ok({ token: "tok", debeCambiarClave: true, centros: [] })),
    ),
    resolver: vi.fn<Acceso["resolver"]>(() => Promise.resolve(sesion)),
    centros: vi.fn<Acceso["centros"]>(() => Promise.resolve([{ id: SEDE, nombre: "Centro" }])),
    sedes: vi.fn<Acceso["sedes"]>(() => Promise.resolve([{ id: SEDE, nombre: "Norte" }])),
    zonaHoraria: vi.fn<Acceso["zonaHoraria"]>(() => Promise.resolve("America/Montevideo")),
    elegirCentro: vi.fn<Acceso["elegirCentro"]>(() => Promise.resolve(ok(null))),
    elegirSede: vi.fn<Acceso["elegirSede"]>(() => Promise.resolve(ok(null))),
    salir: vi.fn<Acceso["salir"]>(() => Promise.resolve()),
    cambiarClave: vi.fn<Acceso["cambiarClave"]>(() => Promise.resolve(ok(null))),
  } satisfies Acceso;
}

/** Simula a la API: deja la sesión en el pedido y anota lo que declara cada ruta. */
async function app(acceso = accesoDoble()) {
  const servidor = Fastify();
  const declaradas: Record<string, FastifyContextConfig> = {};
  servidor.addHook("onRoute", (ruta) => {
    // Fastify suma solo un HEAD por cada GET, con la misma configuración.
    if (ruta.method === "HEAD") return;
    declaradas[`${String(ruta.method)} ${ruta.url}`] = ruta.config ?? {};
  });
  servidor.addHook("onRequest", (pedido, _respuesta, listo) => {
    if (pedido.url !== "/sesion" || pedido.method !== "POST") pedido.sesion = sesion;
    listo();
  });
  await servidor.register(rutasDeSesion(acceso));
  return { servidor, acceso, declaradas };
}

describe("POST /sesion (entrar)", () => {
  it("fija la cookie y devuelve si tiene que cambiar la clave y sus centros", async () => {
    const { servidor, acceso } = await app();
    const respuesta = await servidor.inject({
      method: "POST",
      url: "/sesion",
      payload: { email: " ana@ejemplo.com", clave: "x" },
      remoteAddress: "10.1.2.3",
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.headers["set-cookie"]).toMatch(/^__Host-sesion=tok;.*HttpOnly/);
    expect(respuesta.json()).toEqual({ debeCambiarClave: true, centros: [] });
    expect(acceso.entrar).toHaveBeenCalledWith({
      email: "ana@ejemplo.com",
      clave: "x",
      origen: "10.1.2.3",
    });
  });

  it("con credenciales incorrectas responde 401 sin cookie", async () => {
    const acceso = accesoDoble();
    acceso.entrar.mockResolvedValue(
      falla("credenciales-incorrectas", "Email o contraseña incorrectos."),
    );
    const { servidor } = await app(acceso);
    const respuesta = await servidor.inject({
      method: "POST",
      url: "/sesion",
      payload: { email: "ana@ejemplo.com", clave: "x" },
    });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.headers["set-cookie"]).toBeUndefined();
    expect(respuesta.json()).toEqual({
      error: { codigo: "credenciales-incorrectas", mensaje: "Email o contraseña incorrectos." },
    });
  });

  it("un pedido mal formado responde 400 y no llega a Acceso", async () => {
    const { servidor, acceso } = await app();
    const respuesta = await servidor.inject({
      method: "POST",
      url: "/sesion",
      payload: { email: "ana" },
    });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({ error: { codigo: "pedido-invalido" } });
    expect(acceso.entrar).not.toHaveBeenCalled();
  });
});

describe("estado, centro, sede, clave y salida", () => {
  it("GET /sesion devuelve el estado con el centro activo y sus permisos, sin repetir", async () => {
    const { servidor } = await app();
    const respuesta = await servidor.inject({ url: "/sesion" });
    expect(respuesta.json()).toEqual({
      debeCambiarClave: false,
      centros: [{ id: SEDE, nombre: "Centro" }],
      centroActivo: {
        id: SEDE,
        nombre: "Centro",
        sedeActiva: "todas",
        sedes: [{ id: SEDE, nombre: "Norte" }],
        sedeCambiada: false,
        permisos: ["caja.ver", "usuarios.ver"],
        zonaHoraria: "America/Montevideo",
      },
    });
  });

  it("PUT /sesion/sede pasa la sede elegida y traduce sus fallas a 403", async () => {
    const acceso = accesoDoble();
    const { servidor } = await app(acceso);
    const bien = await servidor.inject({
      method: "PUT",
      url: "/sesion/sede",
      payload: { sede: SEDE },
    });
    expect(bien.statusCode).toBe(204);
    expect(acceso.elegirSede).toHaveBeenCalledWith(sesion, SEDE);
    acceso.elegirSede.mockResolvedValue(falla("sede-ajena", "No tenés permisos en esa sede."));
    const mal = await servidor.inject({
      method: "PUT",
      url: "/sesion/sede",
      payload: { sede: "todas" },
    });
    expect(mal.statusCode).toBe(403);
  });

  it("PUT /sesion/centro elige el centro", async () => {
    const { servidor, acceso } = await app();
    const respuesta = await servidor.inject({
      method: "PUT",
      url: "/sesion/centro",
      payload: { centroId: SEDE },
    });
    expect(respuesta.statusCode).toBe(204);
    expect(acceso.elegirCentro).toHaveBeenCalledWith(sesion, SEDE);
  });

  it("PUT /sesion/clave: una clave actual incorrecta responde 400", async () => {
    const acceso = accesoDoble();
    acceso.cambiarClave.mockResolvedValue(
      falla("clave-incorrecta", "La contraseña actual no es correcta."),
    );
    const { servidor } = await app(acceso);
    const respuesta = await servidor.inject({
      method: "PUT",
      url: "/sesion/clave",
      payload: { actual: "x", nueva: "una clave nueva" },
    });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({ error: { codigo: "clave-incorrecta" } });
  });

  it("DELETE /sesion revoca la sesión y borra la cookie", async () => {
    const { servidor, acceso } = await app();
    const respuesta = await servidor.inject({ method: "DELETE", url: "/sesion" });
    expect(respuesta.statusCode).toBe(204);
    expect(respuesta.headers["set-cookie"]).toMatch(/^__Host-sesion=; .*Max-Age=0/);
    expect(acceso.salir).toHaveBeenCalledWith(sesion);
  });
});

describe("lo que declara cada ruta", () => {
  it("solo entrar es pública; salir, el estado y cambiar la clave sirven con la clave temporal", async () => {
    const { declaradas } = await app();
    expect(declaradas).toEqual({
      "POST /sesion": { publica: true },
      "GET /sesion": { soloSesion: true, aunConClaveTemporal: true },
      "DELETE /sesion": { soloSesion: true, aunConClaveTemporal: true },
      "PUT /sesion/clave": { soloSesion: true, aunConClaveTemporal: true },
      "PUT /sesion/centro": { soloSesion: true },
      "PUT /sesion/sede": { soloSesion: true },
    });
  });
});
