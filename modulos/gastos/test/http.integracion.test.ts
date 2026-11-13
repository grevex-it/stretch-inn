// Rutas /gastos sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// gastos. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import { CATEGORIAS_DE_GASTO, gastoCargado, paginaDeGastos } from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { CATEGORIAS, crearGastos, rutasDeGastos } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

async function app(contexto: ContextoCentro) {
  const servidor = Fastify();
  const declaradas: Record<string, FastifyContextConfig> = {};
  servidor.addHook("onRoute", (ruta) => {
    if (ruta.method !== "HEAD")
      declaradas[`${String(ruta.method)} ${ruta.url}`] = ruta.config ?? {};
  });
  servidor.addHook("onRequest", (pedido, _respuesta, listo) => {
    pedido.sesion = {
      sesionId: "s",
      cuentaId: "c",
      debeCambiarClave: false,
      centro: { contexto, sedeActiva: "todas", sedes: [], sedeCambiada: false },
    };
    listo();
  });
  const ahora = () => new Date("2026-11-13T15:00:00Z");
  await servidor.register(rutasDeGastos(crearGastos(base, { ahora })));
  return { servidor, declaradas };
}

describe("rutas de los gastos", () => {
  it("cada ruta declara su permiso", async () => {
    const { ctx } = await centroConDosSedes(base);
    const { declaradas } = await app(ctx);
    const permisos = Object.fromEntries(
      Object.entries(declaradas).map(([ruta, config]) => [ruta, config.permiso]),
    );
    expect(permisos).toEqual({
      "POST /gastos": "gastos.cargar",
      "POST /gastos/:id/anulacion": "gastos.anular",
      "GET /gastos": "gastos.ver",
    });
  });

  it("cargar con 201 (200 si se repite), listar con el contrato y anular con 204", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const { servidor } = await app(ctx);
    const payload = {
      sedeId: norte,
      fecha: "2026-11-10",
      monto: 45_000,
      categoria: "servicios",
      medio: "efectivo",
      descripcion: "Luz",
      claveIdempotencia: randomUUID(),
    };

    const alta = await servidor.inject({ method: "POST", url: "/gastos", payload });
    expect(alta.statusCode).toBe(201);
    const { id } = gastoCargado.parse(alta.json());
    expect((await servidor.inject({ method: "POST", url: "/gastos", payload })).statusCode).toBe(
      200,
    );
    const url = `/gastos?sede=${norte}&desde=2026-11-01&hasta=2026-11-30`;
    expect(paginaDeGastos.parse((await servidor.inject({ url })).json())).toMatchObject({
      total: 1,
      gastado: 45_000,
    });
    const anulacion = await servidor.inject({
      method: "POST",
      url: `/gastos/${id}/anulacion`,
      payload: { motivo: "Repetido" },
    });
    expect(anulacion.statusCode).toBe(204);
    expect(paginaDeGastos.parse((await servidor.inject({ url })).json()).gastado).toBe(0);
  });

  it("traduce las fallas: 400 mal formado, 403 sin permiso, 404 inexistente", async () => {
    const { norte, otra } = await centroConDosSedes(base);
    const { servidor } = await app(await otra({ norte: ["gastos.ver"], sur: [] }));

    const mal = await servidor.inject({ method: "POST", url: "/gastos", payload: { monto: 1 } });
    expect(mal.statusCode).toBe(400);
    const ajena = await servidor.inject({
      method: "POST",
      url: "/gastos",
      payload: {
        sedeId: norte,
        fecha: "2026-11-10",
        monto: 1,
        categoria: "otros",
        medio: "efectivo",
        descripcion: "",
        claveIdempotencia: randomUUID(),
      },
    });
    expect(ajena.statusCode).toBe(403);
    const inexistente = await servidor.inject({
      method: "POST",
      url: `/gastos/${randomUUID()}/anulacion`,
      payload: { motivo: "No va" },
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it("las categorías del módulo y las del contrato son las mismas", () => {
    expect([...CATEGORIAS]).toEqual([...CATEGORIAS_DE_GASTO]);
  });
});
