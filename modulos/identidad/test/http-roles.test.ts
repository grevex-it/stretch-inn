// Rutas de roles, asignaciones y ajustes (0007): traducen HTTP ↔ Roles. Las reglas las prueban los
// tests de integración; acá, con un Roles doble, se prueba la traducción y lo que declara cada ruta.
import { falla, id, ok } from "@app/nucleo";
import type { SesionDelPedido } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { rutasDeRoles, type Roles } from "../src/index.ts";

const UUID = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
const OTRO = "1b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f61";
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
const FICHA = {
  id: UUID,
  nombre: "Profe",
  plantilla: null,
  permisos: ["caja.ver" as const],
  version: 1,
};
const HECHO = () => Promise.resolve(ok(null));

function rolesDoble() {
  return {
    catalogo: vi.fn<Roles["catalogo"]>(() => [
      { seccion: "Caja", permisos: [{ permiso: "caja.ver", descripcion: "Ver" }] },
    ]),
    rol: vi.fn<Roles["rol"]>(() => Promise.resolve(ok(FICHA))),
    crearRol: vi.fn<Roles["crearRol"]>(() => Promise.resolve(ok({ id: UUID }))),
    editarRol: vi.fn<Roles["editarRol"]>(() => Promise.resolve(ok({ version: 2 }))),
    borrarRol: vi.fn<Roles["borrarRol"]>(HECHO),
    permisosDe: vi.fn<Roles["permisosDe"]>(() =>
      Promise.resolve(ok({ asignaciones: [], permisos: [] })),
    ),
    asignar: vi.fn<Roles["asignar"]>(HECHO),
    quitarAsignacion: vi.fn<Roles["quitarAsignacion"]>(HECHO),
    ajustar: vi.fn<Roles["ajustar"]>(HECHO),
    quitarAjuste: vi.fn<Roles["quitarAjuste"]>(HECHO),
  } satisfies Roles;
}

async function app(roles = rolesDoble()) {
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
  await servidor.register(rutasDeRoles(roles));
  return { servidor, roles, declaradas };
}

describe("rutas de roles", () => {
  it("cada ruta declara su permiso", async () => {
    const { declaradas } = await app();
    expect(Object.fromEntries(Object.entries(declaradas).map(([r, c]) => [r, c.permiso]))).toEqual({
      "GET /equipo/catalogo": "usuarios.ver",
      "GET /equipo/roles/:id": "roles.gestionar",
      "POST /equipo/roles": "roles.gestionar",
      "PUT /equipo/roles/:id": "roles.gestionar",
      "DELETE /equipo/roles/:id": "roles.gestionar",
      "GET /equipo/:id/permisos": "usuarios.ver",
      "POST /equipo/:id/asignaciones": "usuarios.gestionar",
      "DELETE /equipo/:id/asignaciones/:sedeId/:rolId": "usuarios.gestionar",
      "PUT /equipo/:id/ajustes": "usuarios.gestionar",
      "DELETE /equipo/:id/ajustes/:sedeId/:permiso": "usuarios.gestionar",
    });
  });

  it("el catálogo, la ficha de un rol, crear, editar y borrar", async () => {
    const { servidor, roles } = await app();
    expect((await servidor.inject({ url: "/equipo/catalogo" })).json()).toEqual({
      secciones: [{ seccion: "Caja", permisos: [{ permiso: "caja.ver", descripcion: "Ver" }] }],
    });
    expect((await servidor.inject({ url: `/equipo/roles/${UUID}` })).json()).toEqual(FICHA);
    const rol = { nombre: "Profe", permisos: ["caja.ver"] };
    const creado = await servidor.inject({ method: "POST", url: "/equipo/roles", payload: rol });
    expect([creado.statusCode, creado.json()]).toEqual([201, { id: UUID }]);
    const editado = await servidor.inject({
      method: "PUT",
      url: `/equipo/roles/${UUID}`,
      payload: { ...rol, version: 1 },
    });
    expect(editado.json()).toEqual({ version: 2 });
    expect(roles.editarRol).toHaveBeenCalledWith(contexto, { ...rol, id: UUID, version: 1 });
    const borrado = await servidor.inject({ method: "DELETE", url: `/equipo/roles/${UUID}` });
    expect(borrado.statusCode).toBe(204);
  });

  it("asignaciones y ajustes de un integrante", async () => {
    const { servidor, roles } = await app();
    const base = `/equipo/${UUID}`;
    expect((await servidor.inject({ url: `${base}/permisos` })).json()).toEqual({
      asignaciones: [],
      permisos: [],
    });
    const asignacion = { sedeId: OTRO, rolId: UUID };
    const asignado = await servidor.inject({
      method: "POST",
      url: `${base}/asignaciones`,
      payload: asignacion,
    });
    expect(asignado.statusCode).toBe(204);
    expect(roles.asignar).toHaveBeenCalledWith(contexto, UUID, asignacion);
    await servidor.inject({ method: "DELETE", url: `${base}/asignaciones/${OTRO}/${UUID}` });
    expect(roles.quitarAsignacion).toHaveBeenCalledWith(contexto, UUID, asignacion);
    const ajuste = { sedeId: OTRO, permiso: "caja.ver", tipo: "quitado" };
    await servidor.inject({ method: "PUT", url: `${base}/ajustes`, payload: ajuste });
    expect(roles.ajustar).toHaveBeenCalledWith(contexto, UUID, ajuste);
    await servidor.inject({ method: "DELETE", url: `${base}/ajustes/${OTRO}/caja.ver` });
    expect(roles.quitarAjuste).toHaveBeenCalledWith(contexto, UUID, {
      sedeId: OTRO,
      permiso: "caja.ver",
    });
  });

  it("cada falla con su estado, y los datos inválidos con 400", async () => {
    const roles = rolesDoble();
    const { servidor } = await app(roles);
    const casos = [
      ["rol-inexistente", 404],
      ["permisos-ajenos", 403],
      ["mas-permisos", 403],
      ["persona-protegida", 403],
      ["rol-de-plantilla", 409],
      ["rol-en-uso", 409],
      ["cambio-concurrente", 409],
    ] as const;
    for (const [codigo, estado] of casos) {
      roles.borrarRol.mockResolvedValueOnce(falla(codigo, "No."));
      const respuesta = await servidor.inject({ method: "DELETE", url: `/equipo/roles/${UUID}` });
      expect([codigo, respuesta.statusCode]).toEqual([codigo, estado]);
      expect(respuesta.json()).toEqual({ error: { codigo, mensaje: "No." } });
    }
    const mal = await servidor.inject({
      method: "PUT",
      url: `/equipo/${UUID}/ajustes`,
      payload: { sedeId: OTRO, permiso: "Caja", tipo: "extra" },
    });
    expect([mal.statusCode, mal.json()]).toEqual([
      400,
      { error: { codigo: "pedido-invalido", mensaje: "Ese permiso no existe." } },
    ]);
    expect((await servidor.inject({ url: "/equipo/x/permisos" })).statusCode).toBe(400);
  });
});
