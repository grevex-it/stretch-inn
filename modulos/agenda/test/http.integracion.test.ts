// Rutas /agenda sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// agenda. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula con una real.
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAgenda, rutasDeAgenda } from "../src/index.ts";
import { centroConDosSedes, lunesDe, STRETCHING, TODO } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const proximoLunes = lunesDe(new Date(Date.now() + 7 * 86_400_000));

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
  await servidor.register(rutasDeAgenda(crearAgenda(base)));
  return { servidor, declaradas };
}

async function conClase() {
  const centro = await centroConDosSedes(base, { norte: TODO, sur: ["personas.ver"] });
  const { servidor, declaradas } = await app(centro.ctx);
  const alta = await servidor.inject({
    method: "POST",
    url: "/agenda/clases",
    payload: { ...STRETCHING, sedeId: centro.norte },
  });
  return { ...centro, servidor, declaradas, alta, claseId: alta.json<{ id: string }>().id };
}

describe("rutas de la agenda", () => {
  it("cada ruta declara su permiso: ver para leer, gestionar para cambiar", async () => {
    const { declaradas } = await conClase();
    const permisos = Object.fromEntries(
      Object.entries(declaradas).map(([ruta, config]) => [ruta, config.permiso]),
    );
    expect(permisos).toEqual({
      "GET /agenda/clases": "agenda.ver",
      "POST /agenda/clases": "agenda.gestionar",
      "PUT /agenda/clases/:id": "agenda.gestionar",
      "PUT /agenda/clases/:id/baja": "agenda.gestionar",
      "DELETE /agenda/clases/:id/baja": "agenda.gestionar",
      "GET /agenda/ocurrencias": "agenda.ver",
      "PUT /agenda/ocurrencias/:id/cancelada": "agenda.gestionar",
      "DELETE /agenda/ocurrencias/:id/cancelada": "agenda.gestionar",
    });
  });

  it("alta con 201, lista paginada y edición con la versión", async () => {
    const { servidor, alta, claseId, norte } = await conClase();
    expect(alta.statusCode).toBe(201);

    const lista = await servidor.inject({ url: `/agenda/clases?sede=${norte}` });
    expect(lista.json()).toMatchObject({ pagina: 1, porPagina: 50, total: 1 });

    const edicion = await servidor.inject({
      method: "PUT",
      url: `/agenda/clases/${claseId}`,
      payload: { ...STRETCHING, cupo: 20, version: 1 },
    });
    expect(edicion.statusCode).toBe(200);
    expect(edicion.json()).toEqual({ version: 2 });
    const vieja = await servidor.inject({
      method: "PUT",
      url: `/agenda/clases/${claseId}`,
      payload: { ...STRETCHING, version: 1 },
    });
    expect(vieja.statusCode).toBe(409);
  });

  it("los errores llegan con su estado y un mensaje para la persona", async () => {
    const { servidor, sur, norte } = await conClase();
    const invalida = await servidor.inject({
      method: "POST",
      url: "/agenda/clases",
      payload: { ...STRETCHING, hora: "25:00", sedeId: norte },
    });
    expect(invalida.statusCode).toBe(400);
    expect(invalida.json()).toMatchObject({ error: { codigo: "hora-invalida" } });

    const sinPermiso = await servidor.inject({
      method: "POST",
      url: "/agenda/clases",
      payload: { ...STRETCHING, sedeId: sur },
    });
    expect(sinPermiso.statusCode).toBe(403);

    const inexistente = await servidor.inject({
      method: "PUT",
      url: `/agenda/clases/${randomUUID()}/baja`,
    });
    expect(inexistente.statusCode).toBe(404);

    const pedidoMalo = await servidor.inject({ url: "/agenda/ocurrencias?sede=no-es-un-id" });
    expect(pedidoMalo.statusCode).toBe(400);
  });

  it("la semana trae las fechas con su hora en UTC, y se cancelan con 204", async () => {
    const { servidor, norte } = await conClase();
    const semana = await servidor.inject({
      url: `/agenda/ocurrencias?sede=${norte}&desde=${proximoLunes}`,
    });
    expect(semana.statusCode).toBe(200);
    const [fecha] = semana.json<{ elementos: { id: string; empiezaEn: string }[] }>().elementos;
    expect(fecha?.empiezaEn).toBe(`${proximoLunes}T21:30:00.000Z`);

    const cancelar = await servidor.inject({
      method: "PUT",
      url: `/agenda/ocurrencias/${fecha?.id ?? ""}/cancelada`,
    });
    expect(cancelar.statusCode).toBe(204);
  });
});
