// Rutas /profesores sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// profesores. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import { paginaDeProfesConTipo, paginaDeTarifas } from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearProfesores, rutasDeProfesores } from "../src/index.ts";
import { centroConDosSedes, profe } from "./ayudas.ts";

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
  const ahora = () => new Date("2026-11-20T15:00:00Z");
  await servidor.register(rutasDeProfesores(crearProfesores(base, { ahora })));
  return { servidor, declaradas };
}

describe("rutas de profesores", () => {
  it("cada ruta declara su permiso", async () => {
    const { ctx } = await centroConDosSedes(base);
    const { declaradas } = await app(ctx);
    expect(Object.fromEntries(Object.entries(declaradas).map(([r, c]) => [r, c.permiso]))).toEqual({
      "GET /profesores": "profesores.ver",
      "PUT /profesores/:id/tipo": "profesores.configurar",
      "GET /profesores/tarifas": "profesores.ver",
      "POST /profesores/tarifas": "profesores.configurar",
    });
  });

  it("el tipo y las tarifas, con el contrato; lo inválido da 400", async () => {
    const { ctx, norte } = await centroConDosSedes(base);
    const { servidor } = await app(ctx);
    const lore = await profe(ctx.centroId, "Lore");

    const tipo = await servidor.inject({
      method: "PUT",
      url: `/profesores/${lore}/tipo`,
      payload: { tipo: "socio" },
    });
    expect(tipo.statusCode).toBe(204);
    const profes = paginaDeProfesConTipo.parse(
      (await servidor.inject({ url: "/profesores" })).json(),
    );
    expect(profes.elementos.find((p) => p.id === lore)?.tipo).toBe("socio");

    const alta = await servidor.inject({
      method: "POST",
      url: "/profesores/tarifas",
      payload: { sedeId: norte, profeId: lore, monto: 15_000, desde: "2026-11-20" },
    });
    expect(alta.statusCode).toBe(204);
    const tarifas = paginaDeTarifas.parse(
      (await servidor.inject({ url: `/profesores/tarifas?sede=${norte}` })).json(),
    );
    expect(tarifas.elementos).toMatchObject([{ profeId: lore, monto: 15_000, hasta: null }]);
    const atras = await servidor.inject({
      method: "POST",
      url: "/profesores/tarifas",
      payload: { sedeId: null, profeId: null, monto: 1, desde: "2026-11-01" },
    });
    expect(atras.statusCode).toBe(400);
  });
});
