// Rutas /asistencia sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// asistencia. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import { avisoHecho, paginaDeCreditos, planillaDeAsistencia } from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAsistencia, rutasDeAsistencia } from "../src/index.ts";
import { claseConFecha } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

async function app(contexto: ContextoCentro, ahora: Date) {
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
  await servidor.register(rutasDeAsistencia(crearAsistencia(base, { ahora: () => ahora })));
  return { servidor, declaradas };
}

describe("rutas de la asistencia", () => {
  it("cada ruta declara su permiso: ver para leer la planilla, tomar para guardarla", async () => {
    const { ctx, fecha } = await claseConFecha(base);
    const { declaradas } = await app(ctx, fecha.empiezaEn);
    const permisos = Object.fromEntries(
      Object.entries(declaradas).map(([ruta, config]) => [ruta, config.permiso]),
    );
    expect(permisos).toEqual({
      "GET /asistencia/fechas/:id": "asistencia.ver",
      "PUT /asistencia/fechas/:id": "asistencia.tomar",
      "POST /asistencia/fechas/:id/avisos": "asistencia.avisar",
      "DELETE /asistencia/avisos/:id": "asistencia.avisar",
      "GET /alumnos/:id/creditos": "asistencia.ver",
    });
  });

  it("GET /alumnos/:id/creditos devuelve los créditos vigentes con el contrato", async () => {
    const { ctx, ana, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, new Date(fecha.empiezaEn.getTime() - 3 * 60 * 60_000));
    await servidor.inject({
      method: "POST",
      url: `/asistencia/fechas/${fecha.id}/avisos`,
      payload: { alumnoId: ana },
    });
    const respuesta = await servidor.inject({ url: `/alumnos/${ana}/creditos` });
    expect(respuesta.statusCode).toBe(200);
    expect(paginaDeCreditos.parse(respuesta.json()).elementos.map((c) => c.ocurrenciaId)).toEqual([
      fecha.id,
    ]);
  });

  it("POST avisa (201 con el id), DELETE lo anula (204) y repetir da 409 y 404", async () => {
    const { ctx, ana, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, new Date(fecha.empiezaEn.getTime() - 60 * 60_000));
    const url = `/asistencia/fechas/${fecha.id}/avisos`;

    const aviso = await servidor.inject({ method: "POST", url, payload: { alumnoId: ana } });
    expect(aviso.statusCode).toBe(201);
    const { id } = avisoHecho.parse(aviso.json());
    const otraVez = await servidor.inject({ method: "POST", url, payload: { alumnoId: ana } });
    expect(otraVez.statusCode).toBe(409);

    const anular = { method: "DELETE" as const, url: `/asistencia/avisos/${id}` };
    expect((await servidor.inject(anular)).statusCode).toBe(204);
    expect((await servidor.inject(anular)).statusCode).toBe(404);
  });

  it("PUT guarda las marcas (204) y GET devuelve la planilla con el contrato", async () => {
    const { ctx, ana, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, fecha.empiezaEn);
    const url = `/asistencia/fechas/${fecha.id}`;

    const toma = await servidor.inject({
      method: "PUT",
      url,
      payload: { marcas: [{ alumnoId: ana, estado: "presente" }] },
    });
    expect(toma.statusCode).toBe(204);

    const planilla = await servidor.inject({ url: `${url}?pagina=1` });
    expect(planilla.statusCode).toBe(200);
    const leida = planillaDeAsistencia.parse(planilla.json());
    expect(leida.alumnos.elementos.map((r) => [r.nombre, r.estado])).toEqual([
      ["Ana", "presente"],
      ["Bea", null],
    ]);
  });

  it("traduce las fallas: 400 mal formado, 404 sin fecha, 409 no inscripto", async () => {
    const { ctx, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, fecha.empiezaEn);
    const url = `/asistencia/fechas/${fecha.id}`;

    const vacio = await servidor.inject({ method: "PUT", url, payload: { marcas: [] } });
    expect(vacio.statusCode).toBe(400);
    expect(vacio.json()).toEqual({
      error: { codigo: "pedido-invalido", mensaje: "Marcá al menos un alumno." },
    });

    const otra = await servidor.inject({ url: `/asistencia/fechas/${randomUUID()}` });
    expect(otra.statusCode).toBe(404);

    const ajeno = await servidor.inject({
      method: "PUT",
      url,
      payload: { marcas: [{ alumnoId: randomUUID(), estado: "presente" }] },
    });
    expect(ajeno.statusCode).toBe(409);
    expect(ajeno.json()).toMatchObject({ error: { codigo: "no-inscripto" } });
  });
});
