// Rutas /alumnos sobre Postgres real: lo que declara cada ruta y la traducción HTTP ↔ datos. La
// sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula con una real.
import { saludDeAlumno, saludGuardada } from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { rutasDeAlumnos } from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

async function app(contexto?: ContextoCentro) {
  const servidor = Fastify();
  const declaradas: Record<string, FastifyContextConfig> = {};
  servidor.addHook("onRoute", (ruta) => {
    if (ruta.method !== "HEAD")
      declaradas[`${String(ruta.method)} ${ruta.url}`] = ruta.config ?? {};
  });
  const ctx = contexto ?? (await contextoConPermisos(base, ["personas.ver", "personas.editar"]));
  servidor.addHook("onRequest", (pedido, _respuesta, listo) => {
    pedido.sesion = {
      sesionId: "s",
      cuentaId: "c",
      debeCambiarClave: false,
      centro: { contexto: ctx, sedeActiva: "todas", sedes: [], sedeCambiada: false },
    };
    listo();
  });
  await servidor.register(rutasDeAlumnos(base));
  return { servidor, declaradas };
}

async function crear(servidor: Awaited<ReturnType<typeof app>>["servidor"], datos = {}) {
  const respuesta = await servidor.inject({
    method: "POST",
    url: "/alumnos",
    payload: { ...ANA, ...datos },
  });
  return respuesta.json<{ id: string }>().id;
}

describe("rutas de alumnos", () => {
  it("cada ruta declara su permiso: ver para leer, editar para cambiar", async () => {
    const { declaradas } = await app();
    expect(Object.fromEntries(Object.entries(declaradas).map(([r, c]) => [r, c.permiso]))).toEqual({
      "GET /alumnos": "personas.ver",
      "GET /alumnos/:id": "personas.ver",
      "POST /alumnos": "personas.editar",
      "PUT /alumnos/:id": "personas.editar",
      "PUT /alumnos/:id/baja": "personas.editar",
      "DELETE /alumnos/:id/baja": "personas.editar",
      "GET /alumnos/:id/salud": "personas.ver-salud",
      "PUT /alumnos/:id/salud": "personas.editar-salud",
    });
  });

  it("los datos de salud: se leen y se guardan con el contrato y la versión", async () => {
    const ctx = await contextoConPermisos(base, [
      "personas.ver",
      "personas.editar",
      "personas.ver-salud",
      "personas.editar-salud",
    ]);
    const { servidor } = await app(ctx);
    const id = await crear(servidor);
    const url = `/alumnos/${id}/salud`;

    expect(saludDeAlumno.parse((await servidor.inject({ url })).json())).toEqual({
      patologias: "",
      version: 0,
    });
    const guardar = (version: number) =>
      servidor.inject({ method: "PUT", url, payload: { patologias: "Escoliosis.", version } });
    const guardada = await guardar(0);
    expect(guardada.statusCode).toBe(200);
    expect(saludGuardada.parse(guardada.json())).toEqual({ version: 1 });
    expect((await guardar(0)).statusCode).toBe(409);
    expect((await servidor.inject({ url: `/alumnos/${randomUUID()}/salud` })).statusCode).toBe(404);
  });

  it("alta, ficha y búsqueda", async () => {
    const { servidor } = await app();
    const alta = await servidor.inject({ method: "POST", url: "/alumnos", payload: ANA });
    expect(alta.statusCode).toBe(201);
    const { id } = alta.json<{ id: string }>();

    const ficha = await servidor.inject({ url: `/alumnos/${id}` });
    expect(ficha.json()).toEqual({ ...ANA, id, activo: true, version: 1 });
    const lista = await servidor.inject({ url: "/alumnos?buscar=perez" });
    expect(lista.json()).toMatchObject({ pagina: 1, porPagina: 50, total: 1 });
  });

  it("editar con una versión vieja responde 409; un documento repetido también", async () => {
    const { servidor } = await app();
    const id = await crear(servidor);
    await crear(servidor, { nombre: "Bea", documento: "30123456" });
    const url = `/alumnos/${id}`;

    const bien = await servidor.inject({ method: "PUT", url, payload: { ...ANA, version: 1 } });
    const vieja = await servidor.inject({ method: "PUT", url, payload: { ...ANA, version: 1 } });
    const repetido = await servidor.inject({
      method: "PUT",
      url,
      payload: { ...ANA, documento: "30123456", version: 2 },
    });

    expect(bien.json()).toEqual({ version: 2 });
    expect(vieja.statusCode).toBe(409);
    expect(repetido.json()).toMatchObject({ error: { codigo: "documento-repetido" } });
    expect(repetido.statusCode).toBe(409);
  });

  it("baja y reactivación con 204; la baja sale de la lista salvo con bajas=si", async () => {
    const { servidor } = await app();
    const id = await crear(servidor);
    expect((await servidor.inject({ method: "PUT", url: `/alumnos/${id}/baja` })).statusCode).toBe(
      204,
    );
    expect((await servidor.inject({ url: "/alumnos" })).json()).toMatchObject({ total: 0 });
    expect((await servidor.inject({ url: "/alumnos?bajas=si" })).json()).toMatchObject({
      total: 1,
    });
    expect(
      (await servidor.inject({ method: "DELETE", url: `/alumnos/${id}/baja` })).statusCode,
    ).toBe(204);
  });

  it("un alumno inexistente o de otro centro responde 404", async () => {
    const otro = await app();
    const ajeno = await crear(otro.servidor);
    const { servidor } = await app();
    expect((await servidor.inject({ url: `/alumnos/${ajeno}` })).statusCode).toBe(404);
    expect((await servidor.inject({ url: `/alumnos/${randomUUID()}` })).statusCode).toBe(404);
    expect(
      (await servidor.inject({ method: "PUT", url: `/alumnos/${ajeno}/baja` })).statusCode,
    ).toBe(404);
  });

  it("datos inválidos responden 400 con el mensaje para la persona", async () => {
    const { servidor } = await app();
    const contrato = await servidor.inject({
      method: "POST",
      url: "/alumnos",
      payload: { ...ANA, nombre: "" },
    });
    const regla = await servidor.inject({
      method: "POST",
      url: "/alumnos",
      payload: { ...ANA, telefono: "12" },
    });
    const id = await servidor.inject({ url: "/alumnos/x" });
    expect(contrato.json()).toEqual({
      error: { codigo: "pedido-invalido", mensaje: "Escribí el nombre." },
    });
    expect(regla.statusCode).toBe(400);
    expect(regla.json()).toMatchObject({ error: { codigo: "telefono-invalido" } });
    expect(id.statusCode).toBe(400);
  });
});
