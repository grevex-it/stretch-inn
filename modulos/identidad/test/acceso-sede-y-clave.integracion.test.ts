// Sede activa y cambio de clave de la 0017, sobre Postgres real.
import { id } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, type Acceso } from "../src/index.ts";
import { CLAVE, centroConSedes, comoDueno, cuenta, usuario } from "./ayudas-acceso.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

async function entrarYResolver(acceso: Acceso, email: string) {
  const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: "10.0.0.1" });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const sesion = await acceso.resolver(ingreso.valor.token);
  if (sesion === undefined) throw new Error("sin sesión");
  return { token: ingreso.valor.token, sesion };
}

/** Un centro con dos sedes y una cuenta con permisos en las dos. */
async function enDosSedes() {
  const centro = await centroConSedes("Dos sedes", ["Norte", "Sur"]);
  const [norte, sur] = centro.sedeIds.map((sede) => id<"Sede">(sede));
  if (norte === undefined || sur === undefined) throw new Error("faltan sedes");
  const { cuentaId, email } = await cuenta();
  const usuarioId = await usuario(cuentaId, centro, centro.sedeIds);
  return { centro, norte, sur, email, usuarioId };
}

describe("sede activa", () => {
  it("con varias sedes entra a «todas mis sedes»; al elegir una, el contexto lleva solo esa", async () => {
    const { norte, sur, email } = await enDosSedes();
    const acceso = crearAcceso(base);
    const { token, sesion } = await entrarYResolver(acceso, email);
    expect(sesion.centro?.sedeActiva).toBe("todas");
    expect(sesion.centro?.sedes).toEqual(expect.arrayContaining([norte, sur]));

    await expect(acceso.elegirSede(sesion, sur)).resolves.toEqual({ ok: true, valor: null });
    const enSur = await acceso.resolver(token);
    expect(enSur?.centro?.sedeActiva).toBe(sur);
    expect([...(enSur?.centro?.contexto.permisosPorSede.keys() ?? [])]).toEqual([sur]);
  });

  it("al volver a entrar usa la última sede que eligió en ese centro", async () => {
    const { sur, email } = await enDosSedes();
    const acceso = crearAcceso(base);
    const { sesion } = await entrarYResolver(acceso, email);
    await acceso.elegirSede(sesion, sur);
    const otraVez = await entrarYResolver(acceso, email);
    expect(otraVez.sesion.centro?.sedeActiva).toBe(sur);
  });

  it("no puede elegir una sede donde no tiene permisos", async () => {
    const { email } = await enDosSedes();
    const otra = await centroConSedes("Otro", ["Lejos"]);
    const acceso = crearAcceso(base);
    const { sesion } = await entrarYResolver(acceso, email);
    await expect(
      acceso.elegirSede(sesion, id<"Sede">(otra.sedeIds[0] ?? "")),
    ).resolves.toMatchObject({
      ok: false,
      error: { codigo: "sede-ajena" },
    });
  });

  it("si le quitan los permisos en la sede activa, el próximo pedido lo pasa a otra y avisa", async () => {
    const { centro, sur, email, usuarioId } = await enDosSedes();
    const acceso = crearAcceso(base);
    const { token, sesion } = await entrarYResolver(acceso, email);
    await acceso.elegirSede(sesion, sur);
    await comoDueno("delete from asignaciones where usuario_id = $1 and sede_id = $2", [
      usuarioId,
      sur,
    ]);

    const despues = await acceso.resolver(token);
    expect(despues?.centro?.sedeActiva).toBe(centro.sedeIds[0]);
    expect(despues?.centro?.sedeCambiada).toBe(true);
    const siguiente = await acceso.resolver(token);
    expect(siguiente?.centro?.sedeCambiada).toBe(false);
  });
});

describe("nombres de las sedes", () => {
  it("devuelve las sedes donde tiene permisos, con nombre, aunque la sede activa sea una", async () => {
    const { centro, sur, email } = await enDosSedes();
    const sinPermisos = await centroConSedes("Otro", ["Lejos"]);
    const acceso = crearAcceso(base);
    const { token, sesion } = await entrarYResolver(acceso, email);
    await acceso.elegirSede(sesion, sur);
    const enSur = await acceso.resolver(token);
    if (enSur === undefined) throw new Error("sin sesión");
    const sedes = await acceso.sedes(enSur);
    expect(sedes.map((s) => s.nombre)).toEqual(["Norte", "Sur"]);
    expect(sedes.map((s) => s.id)).toEqual(centro.sedeIds);
    expect(sedes.map((s) => s.id)).not.toContain(sinPermisos.sedeIds[0]);
  });
});

describe("cambiar la clave", () => {
  it("exige la clave actual y una nueva de 10 caracteres o más", async () => {
    const { email } = await cuenta();
    const acceso = crearAcceso(base);
    const { sesion } = await entrarYResolver(acceso, email);
    await expect(
      acceso.cambiarClave(sesion, { actual: "no es la clave", nueva: "otra clave larga" }),
    ).resolves.toMatchObject({ ok: false, error: { codigo: "clave-incorrecta" } });
    await expect(
      acceso.cambiarClave(sesion, { actual: CLAVE, nueva: "corta" }),
    ).resolves.toMatchObject({
      ok: false,
      error: { codigo: "clave-corta" },
    });
  });

  it("cambia la clave, saca el aviso de cambio obligatorio y revoca las otras sesiones", async () => {
    const { email } = await cuenta({ debeCambiarClave: true });
    const acceso = crearAcceso(base);
    const otra = await entrarYResolver(acceso, email);
    const esta = await entrarYResolver(acceso, email);

    const nueva = "la clave nueva de Ana";
    await expect(acceso.cambiarClave(esta.sesion, { actual: CLAVE, nueva })).resolves.toEqual({
      ok: true,
      valor: null,
    });
    expect(await acceso.resolver(otra.token)).toBeUndefined();
    expect((await acceso.resolver(esta.token))?.debeCambiarClave).toBe(false);
    const conLaNueva = await acceso.entrar({ email, clave: nueva, origen: "10.0.0.1" });
    expect(conLaNueva.ok).toBe(true);
  });
});
