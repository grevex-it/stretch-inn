// Login de la 0017 sobre Postgres real: credenciales, límite de intentos, centros y sesión.
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso } from "../src/index.ts";
import {
  CLAVE,
  centroConSedes,
  comoDueno,
  cuenta,
  relojDePrueba,
  usuario,
} from "./ayudas-acceso.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const desde = "10.0.0.1";
const INCORRECTAS = {
  ok: false,
  error: { codigo: "credenciales-incorrectas", mensaje: "Email o contraseña incorrectos." },
};

describe("entrar", () => {
  it("con la clave correcta devuelve un token y la sesión queda en el único centro", async () => {
    const centro = await centroConSedes("Centro único", ["Norte"]);
    const { cuentaId, email } = await cuenta();
    await usuario(cuentaId, centro, centro.sedeIds);
    const acceso = crearAcceso(base);

    const ingreso = await acceso.entrar({
      email: email.toUpperCase(),
      clave: CLAVE,
      origen: desde,
    });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    expect(ingreso.valor.centros).toEqual([{ id: centro.centroId, nombre: "Centro único" }]);

    const sesion = await acceso.resolver(ingreso.valor.token);
    expect(sesion?.centro?.contexto.centroId).toBe(centro.centroId);
    expect(sesion?.centro?.sedeActiva).toBe(centro.sedeIds[0]);
  });

  it("email inexistente y clave incorrecta dan exactamente la misma respuesta", async () => {
    const { email } = await cuenta();
    const acceso = crearAcceso(base);
    await expect(
      acceso.entrar({ email, clave: "otra clave larga", origen: desde }),
    ).resolves.toEqual(INCORRECTAS);
    await expect(
      acceso.entrar({ email: "nadie@prueba.com", clave: CLAVE, origen: desde }),
    ).resolves.toEqual(INCORRECTAS);
  });

  it("tras 5 fallos bloquea el par email y origen, aun con la clave correcta", async () => {
    const { email } = await cuenta();
    const acceso = crearAcceso(base);
    for (let i = 0; i < 5; i++) await acceso.entrar({ email, clave: "mal mal mal", origen: desde });
    await expect(acceso.entrar({ email, clave: CLAVE, origen: desde })).resolves.toEqual(
      INCORRECTAS,
    );
    const otroOrigen = await acceso.entrar({ email, clave: CLAVE, origen: "10.0.0.9" });
    expect(otroOrigen.ok).toBe(true);
  });

  it("en la base se guarda el hash del token, nunca el token", async () => {
    const { cuentaId, email } = await cuenta();
    const ingreso = await crearAcceso(base).entrar({ email, clave: CLAVE, origen: desde });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    const filas = await comoDueno<{ hash_token: string }>(
      "select hash_token from plataforma.sesiones where cuenta_id = $1",
      [cuentaId],
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]?.hash_token).not.toBe(ingreso.valor.token);
  });

  it("avisa si la cuenta tiene que cambiar la clave", async () => {
    const { email } = await cuenta({ debeCambiarClave: true });
    const ingreso = await crearAcceso(base).entrar({ email, clave: CLAVE, origen: desde });
    expect(ingreso).toMatchObject({ ok: true, valor: { debeCambiarClave: true } });
  });
});

describe("elegir centro", () => {
  it("con varios centros la sesión arranca sin centro; elige uno donde tiene usuario", async () => {
    const [a, b, ajeno] = await Promise.all([
      centroConSedes("A", ["Norte"]),
      centroConSedes("B", ["Sur"]),
      centroConSedes("Ajeno", ["Este"]),
    ]);
    const { cuentaId, email } = await cuenta();
    await usuario(cuentaId, a, a.sedeIds);
    await usuario(cuentaId, b, b.sedeIds);
    const acceso = crearAcceso(base);
    const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: desde });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    expect(ingreso.valor.centros.map((c) => c.nombre)).toEqual(["A", "B"]);

    const sinCentro = await acceso.resolver(ingreso.valor.token);
    if (sinCentro === undefined) throw new Error("sin sesión");
    expect(sinCentro.centro).toBeNull();

    await expect(acceso.elegirCentro(sinCentro, ajeno.centroId)).resolves.toMatchObject({
      ok: false,
      error: { codigo: "centro-ajeno" },
    });
    await expect(acceso.elegirCentro(sinCentro, b.centroId)).resolves.toEqual({
      ok: true,
      valor: null,
    });
    const enB = await acceso.resolver(ingreso.valor.token);
    expect(enB?.centro?.contexto.centroId).toBe(b.centroId);
  });

  it("un usuario dado de baja no ve ese centro", async () => {
    const centro = await centroConSedes("De baja", ["Norte"]);
    const { cuentaId, email } = await cuenta();
    const usuarioId = await usuario(cuentaId, centro, centro.sedeIds);
    await comoDueno("update usuarios set activo = false where id = $1", [usuarioId]);
    const ingreso = await crearAcceso(base).entrar({ email, clave: CLAVE, origen: desde });
    expect(ingreso).toMatchObject({ ok: true, valor: { centros: [] } });
  });
});

describe("vencimiento y salida", () => {
  it("la sesión vence a las 12 horas sin uso", async () => {
    const { email } = await cuenta();
    const reloj = relojDePrueba();
    const acceso = crearAcceso(base, { ahora: reloj.ahora });
    const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: desde });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    reloj.adelantar(11 * 60 * 60 * 1000);
    expect(await acceso.resolver(ingreso.valor.token)).toBeDefined();
    reloj.adelantar(11 * 60 * 60 * 1000);
    expect(await acceso.resolver(ingreso.valor.token)).toBeDefined();
    reloj.adelantar(12 * 60 * 60 * 1000);
    expect(await acceso.resolver(ingreso.valor.token)).toBeUndefined();
  });

  it("salir revoca la sesión en el momento", async () => {
    const { email } = await cuenta();
    const acceso = crearAcceso(base);
    const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: desde });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    const sesion = await acceso.resolver(ingreso.valor.token);
    if (sesion === undefined) throw new Error("sin sesión");
    await acceso.salir(sesion);
    expect(await acceso.resolver(ingreso.valor.token)).toBeUndefined();
  });

  it("un token inventado no resuelve ninguna sesión", async () => {
    expect(await crearAcceso(base).resolver("no-es-un-token")).toBeUndefined();
  });
});
