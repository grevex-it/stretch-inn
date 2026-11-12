// Rutas /abonos sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// abonos. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import {
  cuotaGenerada,
  paginaDeCuotas,
  paginaDeImpagas,
  paginaDePlanes,
  planCreado,
  renovacionHecha,
} from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAbonos, rutasDeAbonos } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const PLAN = { nombre: "Dos por semana", clasesPorSemana: 2, precio: 30_000 };

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
  const ahora = () => new Date("2026-11-15T12:00:00Z");
  await servidor.register(rutasDeAbonos(crearAbonos(base, { ahora })));
  return { servidor, declaradas };
}

describe("rutas de los abonos", () => {
  it("cada ruta declara su permiso", async () => {
    const { ctx } = await centroConDosSedes(base);
    const { declaradas } = await app(ctx);
    const permisos = Object.fromEntries(
      Object.entries(declaradas).map(([ruta, config]) => [ruta, config.permiso]),
    );
    expect(permisos).toEqual({
      "GET /abonos/planes": "abonos.ver",
      "POST /abonos/planes": "abonos.gestionar",
      "PUT /abonos/planes/:id": "abonos.gestionar",
      "PUT /abonos/planes/:id/baja": "abonos.gestionar",
      "DELETE /abonos/planes/:id/baja": "abonos.gestionar",
      "PUT /abonos/planes/:id/sedes/:sedeId/precio": "abonos.gestionar",
      "DELETE /abonos/planes/:id/sedes/:sedeId/precio": "abonos.gestionar",
      "POST /abonos/cuotas": "abonos.asignar",
      "POST /abonos/cuotas/renovacion": "abonos.asignar",
      "GET /abonos/cuotas/impagas": "abonos.ver",
      "DELETE /abonos/cuotas/:id": "abonos.asignar",
      "GET /alumnos/:id/cuotas": "abonos.ver",
    });
  });

  it("del plan a la cuota del alumno, con el contrato", async () => {
    const { ctx, norte, alumno } = await centroConDosSedes(base);
    const { servidor } = await app(ctx);
    const alta = await servidor.inject({ method: "POST", url: "/abonos/planes", payload: PLAN });
    expect(alta.statusCode).toBe(201);
    const { id } = planCreado.parse(alta.json());
    const precio = await servidor.inject({
      method: "PUT",
      url: `/abonos/planes/${id}/sedes/${norte}/precio`,
      payload: { precio: 28_000 },
    });
    expect(precio.statusCode).toBe(204);
    const planes = paginaDePlanes.parse((await servidor.inject({ url: "/abonos/planes" })).json());
    expect(planes.elementos[0]?.preciosDeSede).toEqual([{ sedeId: norte, precio: 28_000 }]);

    const ana = await alumno();
    const cuota = await servidor.inject({
      method: "POST",
      url: "/abonos/cuotas",
      payload: { alumnoId: ana, planId: id, sedeId: norte },
    });
    expect(cuota.statusCode).toBe(201);
    expect(cuotaGenerada.parse(cuota.json())).toMatchObject({
      monto: 28_000,
      desde: "2026-11-15",
      hasta: "2026-12-13",
    });
    const repetida = await servidor.inject({
      method: "POST",
      url: "/abonos/cuotas",
      payload: { alumnoId: ana, planId: id, sedeId: norte },
    });
    expect(repetida.statusCode).toBe(409);
    const lista = await servidor.inject({ url: `/alumnos/${ana}/cuotas` });
    expect(paginaDeCuotas.parse(lista.json()).total).toBe(1);
  });

  it("renovar los ciclos y las impagas de la sede, con el contrato", async () => {
    const { ctx, norte, alumno } = await centroConDosSedes(base);
    const { servidor } = await app(ctx);
    const alta = await servidor.inject({ method: "POST", url: "/abonos/planes", payload: PLAN });
    const { id } = planCreado.parse(alta.json());
    const ana = await alumno();
    await servidor.inject({
      method: "POST",
      url: "/abonos/cuotas",
      payload: { alumnoId: ana, planId: id, sedeId: norte, desde: "2026-10-18" },
    });
    const renovacion = await servidor.inject({
      method: "POST",
      url: "/abonos/cuotas/renovacion",
      payload: { sedeId: norte },
    });
    expect(renovacion.statusCode).toBe(200);
    expect(renovacionHecha.parse(renovacion.json())).toMatchObject({
      dia: "2026-11-15",
      generadas: 1,
    });

    const impagas = await servidor.inject({ url: `/abonos/cuotas/impagas?sede=${norte}` });
    expect(impagas.statusCode).toBe(200);
    const lista = paginaDeImpagas.parse(impagas.json());
    expect(lista).toMatchObject({ total: 2, adeudado: 60_000 });
    expect(lista.elementos[0]?.alumno).toMatchObject({ nombre: "Ana" });
    const sinSede = await servidor.inject({ url: "/abonos/cuotas/impagas" });
    expect(sinSede.statusCode).toBe(400);
  });

  it("traduce las fallas: 400 mal formado, 404 sin plan", async () => {
    const { ctx } = await centroConDosSedes(base);
    const { servidor } = await app(ctx);
    const mal = await servidor.inject({
      method: "POST",
      url: "/abonos/planes",
      payload: { ...PLAN, precio: 1.5 },
    });
    expect(mal.statusCode).toBe(400);
    const sinPlan = await servidor.inject({
      method: "PUT",
      url: "/abonos/planes/7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67",
      payload: { ...PLAN, version: 1 },
    });
    expect(sinPlan.statusCode).toBe(404);
  });
});
