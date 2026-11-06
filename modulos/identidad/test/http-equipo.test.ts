// Rutas del equipo (0017): traducen HTTP ↔ Equipo. Las reglas las prueban los tests de
// integración; acá, con un Equipo doble, se prueba la traducción y lo que declara cada ruta.
import { falla, id, ok } from "@app/nucleo";
import type { SesionDelPedido } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { rutasDeEquipo, type Equipo } from "../src/index.ts";

const UUID = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
const contexto = {
  centroId: id<"Centro">(UUID),
  actor: { tipo: "usuario", usuarioId: id<"Usuario">(UUID) },
  permisosPorSede: new Map(),
} as const;
const sesion: SesionDelPedido = {
  sesionId: "s-1",
  cuentaId: "c-1",
  debeCambiarClave: false,
  centro: { contexto, sedeActiva: "todas", sedes: [], sedeCambiada: false },
};
const vacia = { pagina: 1, porPagina: 50, total: 0, elementos: [] };

function equipoDoble() {
  return {
    listar: vi.fn<Equipo["listar"]>(() => Promise.resolve(vacia)),
    roles: vi.fn<Equipo["roles"]>(() => Promise.resolve(vacia)),
    darDeAlta: vi.fn<Equipo["darDeAlta"]>(() =>
      Promise.resolve(ok({ usuarioId: UUID, claveTemporal: "abcd-efgh-jkmn" })),
    ),
    resetearClave: vi.fn<Equipo["resetearClave"]>(() =>
      Promise.resolve(ok({ claveTemporal: "abcd-efgh-jkmn" })),
    ),
    bloquear: vi.fn<Equipo["bloquear"]>(() => Promise.resolve(ok(null))),
    reactivar: vi.fn<Equipo["reactivar"]>(() => Promise.resolve(ok(null))),
  } satisfies Equipo;
}

async function app(equipo = equipoDoble()) {
  const servidor = Fastify();
  const declaradas: Record<string, FastifyContextConfig> = {};
  servidor.addHook("onRoute", (ruta) => {
    if (ruta.method === "HEAD") return;
    declaradas[`${String(ruta.method)} ${ruta.url}`] = ruta.config ?? {};
  });
  servidor.addHook("onRequest", (pedido, _respuesta, listo) => {
    pedido.sesion = sesion;
    listo();
  });
  await servidor.register(rutasDeEquipo(equipo));
  return { servidor, equipo, declaradas };
}

const alta = { nombre: "Ana", email: "ana@ejemplo.com", rolId: UUID, sedeIds: [UUID] };

describe("rutas del equipo", () => {
  it("cada ruta declara su permiso: ver para la lista, gestionar para el resto", async () => {
    const { declaradas } = await app();
    expect(Object.fromEntries(Object.entries(declaradas).map(([r, c]) => [r, c.permiso]))).toEqual({
      "GET /equipo": "usuarios.ver",
      "GET /equipo/roles": "usuarios.gestionar",
      "POST /equipo": "usuarios.gestionar",
      "POST /equipo/:id/clave": "usuarios.gestionar",
      "PUT /equipo/:id/bloqueo": "usuarios.gestionar",
      "DELETE /equipo/:id/bloqueo": "usuarios.gestionar",
    });
  });

  it("GET /equipo pasa el contexto del pedido y la página", async () => {
    const { servidor, equipo } = await app();
    const respuesta = await servidor.inject({ method: "GET", url: "/equipo?pagina=2" });
    expect(respuesta.statusCode).toBe(200);
    expect(equipo.listar).toHaveBeenCalledWith(contexto, { pagina: 2, porPagina: 50 });
  });

  it("POST /equipo responde 201 con la clave temporal, sin que quede en ningún caché", async () => {
    const { servidor, equipo } = await app();
    const respuesta = await servidor.inject({ method: "POST", url: "/equipo", payload: alta });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.headers["cache-control"]).toBe("no-store");
    expect(respuesta.json()).toEqual({ usuarioId: UUID, claveTemporal: "abcd-efgh-jkmn" });
    expect(equipo.darDeAlta).toHaveBeenCalledWith(contexto, alta);
  });

  it("un alta inválida responde 400 sin llamar al módulo", async () => {
    const { servidor, equipo } = await app();
    const respuesta = await servidor.inject({
      method: "POST",
      url: "/equipo",
      payload: { ...alta, sedeIds: [] },
    });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({
      error: { codigo: "pedido-invalido", mensaje: "Elegí al menos una sede." },
    });
    expect(equipo.darDeAlta).not.toHaveBeenCalled();
  });

  it.each([
    ["ya-es-del-equipo", 409],
    ["permisos-ajenos", 403],
    ["rol-inexistente", 400],
  ] as const)("una falla %s del alta responde %i", async (codigo, estado) => {
    const equipo = equipoDoble();
    equipo.darDeAlta.mockResolvedValue(falla(codigo, "mensaje"));
    const { servidor } = await app(equipo);
    const respuesta = await servidor.inject({ method: "POST", url: "/equipo", payload: alta });
    expect(respuesta.statusCode).toBe(estado);
    expect(respuesta.json()).toEqual({ error: { codigo, mensaje: "mensaje" } });
  });

  it("POST /equipo/:id/clave devuelve la clave temporal sin caché", async () => {
    const { servidor, equipo } = await app();
    const respuesta = await servidor.inject({ method: "POST", url: `/equipo/${UUID}/clave` });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.headers["cache-control"]).toBe("no-store");
    expect(respuesta.json()).toEqual({ claveTemporal: "abcd-efgh-jkmn" });
    expect(equipo.resetearClave).toHaveBeenCalledWith(contexto, UUID);
  });

  it.each([
    ["mas-permisos", 403],
    ["otros-centros", 403],
    ["usuario-inexistente", 404],
  ] as const)("una falla %s del reset responde %i", async (codigo, estado) => {
    const equipo = equipoDoble();
    equipo.resetearClave.mockResolvedValue(falla(codigo, "mensaje"));
    const { servidor } = await app(equipo);
    const respuesta = await servidor.inject({ method: "POST", url: `/equipo/${UUID}/clave` });
    expect(respuesta.statusCode).toBe(estado);
  });

  it("PUT bloquea y DELETE reactiva, con 204", async () => {
    const { servidor, equipo } = await app();
    const url = `/equipo/${UUID}/bloqueo`;
    expect((await servidor.inject({ method: "PUT", url })).statusCode).toBe(204);
    expect((await servidor.inject({ method: "DELETE", url })).statusCode).toBe(204);
    expect(equipo.bloquear).toHaveBeenCalledWith(contexto, UUID);
    expect(equipo.reactivar).toHaveBeenCalledWith(contexto, UUID);
  });

  it("un id que no es uuid responde 400 sin llamar al módulo", async () => {
    const { servidor, equipo } = await app();
    const respuesta = await servidor.inject({ method: "PUT", url: "/equipo/x/bloqueo" });
    expect(respuesta.statusCode).toBe(400);
    expect(equipo.bloquear).not.toHaveBeenCalled();
  });
});
