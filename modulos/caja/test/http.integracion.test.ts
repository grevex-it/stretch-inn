// Rutas /caja sobre Postgres real: el permiso que declara cada ruta y la traducción HTTP ↔ caja.
// La sesión la deja la API antes (apps/api/src/base/sesion.ts); acá se simula.
import { crearAbonos } from "@app/abonos";
import { cobroHecho, diaDeCaja } from "@app/contratos";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import Fastify, { type FastifyContextConfig } from "fastify";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearCaja, rutasDeCaja } from "../src/index.ts";
import { centroConDosSedes } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const AHORA = new Date("2026-11-09T15:00:00Z");

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
  await servidor.register(rutasDeCaja(crearCaja(base, { ahora: () => AHORA })));
  return { servidor, declaradas };
}

async function conCuota() {
  const centro = await centroConDosSedes(base);
  const abonos = crearAbonos(base, { ahora: () => AHORA });
  const plan = await abonos.crearPlan(centro.ctx, {
    nombre: "Libre",
    clasesPorSemana: 3,
    precio: 35_000,
  });
  if (!plan.ok) throw new Error(plan.error.mensaje);
  const cuota = await abonos.generarCuota(centro.ctx, {
    alumnoId: await centro.alumno(),
    planId: plan.valor.id,
    sedeId: centro.norte,
  });
  if (!cuota.ok) throw new Error(cuota.error.mensaje);
  return { ...centro, cuotaId: cuota.valor.id };
}

describe("rutas de la caja", () => {
  it("cada ruta declara su permiso", async () => {
    const { ctx } = await centroConDosSedes(base);
    const { declaradas } = await app(ctx);
    const permisos = Object.fromEntries(
      Object.entries(declaradas).map(([ruta, config]) => [ruta, config.permiso]),
    );
    expect(permisos).toEqual({
      "POST /caja/cobros": "caja.cobrar",
      "POST /caja/pagos/:id/anulacion": "caja.anular",
      "GET /caja/pagos": "caja.ver",
    });
  });

  it("cobrar (201, y 200 si se repite), anular (204) y el día de caja", async () => {
    const { ctx, norte, cuotaId } = await conCuota();
    const { servidor } = await app(ctx);
    const cobro = { cuotaId, medio: "transferencia", claveIdempotencia: "cobro-de-prueba-1" };

    const primero = await servidor.inject({ method: "POST", url: "/caja/cobros", payload: cobro });
    expect(primero.statusCode).toBe(201);
    const { id } = cobroHecho.parse(primero.json());
    const otraVez = await servidor.inject({ method: "POST", url: "/caja/cobros", payload: cobro });
    expect(otraVez.statusCode).toBe(200);
    expect(cobroHecho.parse(otraVez.json())).toEqual({ id, monto: 35_000, repetido: true });

    const dia = await servidor.inject({ url: `/caja/pagos?sede=${norte}&dia=2026-11-09` });
    expect(diaDeCaja.parse(dia.json())).toMatchObject({ total: 1, cobrado: 35_000 });

    const anulacion = await servidor.inject({
      method: "POST",
      url: `/caja/pagos/${id}/anulacion`,
      payload: { motivo: "Se cobró de más" },
    });
    expect(anulacion.statusCode).toBe(204);
    const despues = await servidor.inject({ url: `/caja/pagos?sede=${norte}&dia=2026-11-09` });
    expect(diaDeCaja.parse(despues.json()).cobrado).toBe(0);
  });

  it("traduce las fallas: 400 sin clave, 409 cuota pagada", async () => {
    const { ctx, cuotaId } = await conCuota();
    const { servidor } = await app(ctx);
    const sinClave = await servidor.inject({
      method: "POST",
      url: "/caja/cobros",
      payload: { cuotaId, medio: "efectivo" },
    });
    expect(sinClave.statusCode).toBe(400);
    await servidor.inject({
      method: "POST",
      url: "/caja/cobros",
      payload: { cuotaId, medio: "efectivo", claveIdempotencia: "cobro-de-prueba-2" },
    });
    const otra = await servidor.inject({
      method: "POST",
      url: "/caja/cobros",
      payload: { cuotaId, medio: "efectivo", claveIdempotencia: "cobro-de-prueba-3" },
    });
    expect(otra.statusCode).toBe(409);
  });
});
