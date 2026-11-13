// Rutas /asistencia sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔
// asistencia. La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import {
  ausenciasAvisadas,
  avisoHecho,
  planillaDeAsistencia,
  recuperacionHecha,
  reglasDeRecuperacion,
} from "@app/contratos";
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

const DIA = 24 * 60 * 60_000;

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
  // Todos tienen un abono vigente: una semana para atrás y tres para adelante.
  const abono = {
    inicio: new Date(ahora.getTime() - 7 * DIA),
    fin: new Date(ahora.getTime() + 21 * DIA),
  };
  const asistencia = crearAsistencia(base, {
    ahora: () => ahora,
    abonoVigente: () => Promise.resolve(abono),
  });
  await servidor.register(rutasDeAsistencia(asistencia));
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
      "POST /asistencia/alumnos/:id/ausencias": "asistencia.avisar",
      "GET /asistencia/sedes/:id/reglas": "asistencia.ver",
      "PUT /asistencia/sedes/:id/reglas": "asistencia.configurar",
      "POST /asistencia/fechas/:id/recuperaciones": "asistencia.recuperar",
      "DELETE /asistencia/recuperaciones/:id": "asistencia.recuperar",
    });
  });

  it("POST recupera (201 con el id), DELETE lo anula (204) y repetir da 409", async () => {
    const { ctx, ana, fecha, otraClase } = await claseConFecha(base);
    const { servidor } = await app(ctx, new Date(fecha.empiezaEn.getTime() - 3 * 60 * 60_000));
    const yoga = await otraClase(2, 0);
    const url = `/asistencia/fechas/${yoga.fecha.id}/recuperaciones`;

    const reserva = await servidor.inject({ method: "POST", url, payload: { alumnoId: ana } });
    expect(reserva.statusCode).toBe(201);
    const { id } = recuperacionHecha.parse(reserva.json());
    const repetida = await servidor.inject({ method: "POST", url, payload: { alumnoId: ana } });
    expect(repetida.statusCode).toBe(409);
    const anular = { method: "DELETE" as const, url: `/asistencia/recuperaciones/${id}` };
    expect((await servidor.inject(anular)).statusCode).toBe(204);
    expect((await servidor.inject(anular)).statusCode).toBe(404);
  });

  it("GET y PUT de las reglas de la sede, con el contrato; mal formadas, 400", async () => {
    const { ctx, norte, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, fecha.empiezaEn);
    const url = `/asistencia/sedes/${norte}/reglas`;
    const mendoza = { anticipacionMinutos: 60, maximoPorAbono: 2, sinAbono: false };
    expect((await servidor.inject({ method: "PUT", url, payload: mendoza })).statusCode).toBe(204);
    const leidas = await servidor.inject({ url });
    expect(leidas.statusCode).toBe(200);
    expect(reglasDeRecuperacion.parse(leidas.json())).toEqual(mendoza);
    const mal = await servidor.inject({
      method: "PUT",
      url,
      payload: { ...mendoza, maximoPorAbono: 1.5 },
    });
    expect(mal.statusCode).toBe(400);
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

  it("POST de ausencias por período avisa sus fechas (201) y valida el período (400)", async () => {
    const { ctx, ana, norte, fecha } = await claseConFecha(base);
    const { servidor } = await app(ctx, new Date(fecha.empiezaEn.getTime() - 60 * 60_000));
    const url = `/asistencia/alumnos/${ana}/ausencias`;

    const viaje = await servidor.inject({
      method: "POST",
      url,
      payload: { sedeId: norte, desde: fecha.fecha, hasta: fecha.fecha },
    });
    expect(viaje.statusCode).toBe(201);
    expect(ausenciasAvisadas.parse(viaje.json())).toEqual({ avisos: 1 });
    const mal = await servidor.inject({
      method: "POST",
      url,
      payload: { sedeId: norte, desde: fecha.fecha },
    });
    expect(mal.statusCode).toBe(400);
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
