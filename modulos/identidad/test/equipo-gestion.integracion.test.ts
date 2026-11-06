// Reset de clave, bloqueo y reactivación sobre Postgres real (ver docs/decisiones/0017).
import { crearBase, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, crearEquipo, type Acceso, type Equipo } from "../src/index.ts";
import { CLAVE, centroConSedes, usuario } from "./ayudas-acceso.ts";
import { centroConEquipo, comoAdmin, entrarComo, integrante } from "./ayudas-equipo.ts";

let base: Base;
let acceso: Acceso;
let equipo: Equipo;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  acceso = crearAcceso(base);
  equipo = crearEquipo(base);
});
afterAll(async () => {
  await base.cerrar();
});

async function puedeEntrar(email: string, clave: string): Promise<boolean> {
  return (await acceso.entrar({ email, clave, origen: randomUUID() })).ok;
}

describe("resetearClave", () => {
  it("genera una clave temporal, invalida la anterior y cierra sus sesiones", async () => {
    const c = await centroConEquipo();
    const ana = await integrante(c, c.recepcion, [c.norte]);
    const { token } = await entrarComo(acceso, ana.email);

    const reset = await equipo.resetearClave(await comoAdmin(acceso, c), ana.usuarioId);
    if (!reset.ok) throw new Error(reset.error.mensaje);

    await expect(acceso.resolver(token)).resolves.toBeUndefined();
    await expect(puedeEntrar(ana.email, CLAVE)).resolves.toBe(false);
    const { sesion } = await entrarComo(acceso, ana.email, { clave: reset.valor.claveTemporal });
    expect(sesion.debeCambiarClave).toBe(true);
  });

  it("no resetea una cuenta con usuarios en otros centros (0017)", async () => {
    const c = await centroConEquipo();
    const otro = await centroConSedes("Otro centro", ["Única"]);
    const profe = await integrante(c, c.recepcion, [c.norte]);
    await usuario(profe.cuentaId, otro, otro.sedeIds);

    const reset = await equipo.resetearClave(await comoAdmin(acceso, c), profe.usuarioId);

    expect(reset).toMatchObject({ ok: false, error: { codigo: "otros-centros" } });
    await expect(puedeEntrar(profe.email, CLAVE)).resolves.toBe(true);
  });

  it("no resetea a un par, ni la propia", async () => {
    const c = await centroConEquipo();
    const socia = await integrante(c, c.duenio, [c.norte, c.sur]);
    const quien = await comoAdmin(acceso, c);

    await expect(equipo.resetearClave(quien, socia.usuarioId)).resolves.toMatchObject({
      ok: false,
      error: { codigo: "mas-permisos" },
    });
    await expect(equipo.resetearClave(quien, c.admin.usuarioId)).resolves.toMatchObject({
      ok: false,
      error: { codigo: "a-vos-mismo" },
    });
    await expect(puedeEntrar(socia.email, CLAVE)).resolves.toBe(true);
  });

  it("con una sede activa no resetea a quien tiene permisos en otra sede", async () => {
    const c = await centroConEquipo();
    const enSur = await integrante(c, c.recepcion, [c.sur]);
    const quien = await comoAdmin(acceso, c, c.norte);
    await expect(equipo.resetearClave(quien, enSur.usuarioId)).resolves.toMatchObject({
      ok: false,
      error: { codigo: "mas-permisos" },
    });
  });

  it("un usuario de otro centro no existe", async () => {
    const c = await centroConEquipo();
    const otro = await centroConEquipo("Otro");
    const ajeno = await integrante(otro, otro.recepcion, [otro.norte]);
    const quien = await comoAdmin(acceso, c);
    await expect(equipo.resetearClave(quien, ajeno.usuarioId)).resolves.toMatchObject({
      ok: false,
      error: { codigo: "usuario-inexistente" },
    });
    await expect(puedeEntrar(ajeno.email, CLAVE)).resolves.toBe(true);
  });
});

describe("bloquear y reactivar", () => {
  it("bloquear cierra sus sesiones del centro en el momento y no lo deja volver a elegirlo", async () => {
    const c = await centroConEquipo();
    const ana = await integrante(c, c.recepcion, [c.norte]);
    const { token } = await entrarComo(acceso, ana.email);
    const quien = await comoAdmin(acceso, c);

    await expect(equipo.bloquear(quien, ana.usuarioId)).resolves.toEqual({ ok: true, valor: null });

    await expect(acceso.resolver(token)).resolves.toBeUndefined();
    const ingreso = await acceso.entrar({ email: ana.email, clave: CLAVE, origen: randomUUID() });
    expect(ingreso.ok && ingreso.valor.centros).toEqual([]);
    const lista = await equipo.listar(quien, { pagina: 1, porPagina: 50 });
    expect(lista.elementos.find((u) => u.id === ana.usuarioId)?.activo).toBe(false);
  });

  it("reactivar le devuelve el acceso", async () => {
    const c = await centroConEquipo();
    const ana = await integrante(c, c.recepcion, [c.norte]);
    const quien = await comoAdmin(acceso, c);
    await equipo.bloquear(quien, ana.usuarioId);

    await expect(equipo.reactivar(quien, ana.usuarioId)).resolves.toEqual({
      ok: true,
      valor: null,
    });

    const { sesion } = await entrarComo(acceso, ana.email);
    expect(sesion.centro?.contexto.centroId).toBe(c.centroId);
  });

  it("no bloquea a un par ni a sí mismo, ni a alguien de otro centro", async () => {
    const c = await centroConEquipo();
    const otro = await centroConEquipo("Otro");
    const socia = await integrante(c, c.duenio, [c.norte, c.sur]);
    const quien = await comoAdmin(acceso, c);

    await expect(equipo.bloquear(quien, socia.usuarioId)).resolves.toMatchObject({
      error: { codigo: "mas-permisos" },
    });
    await expect(equipo.bloquear(quien, c.admin.usuarioId)).resolves.toMatchObject({
      error: { codigo: "a-vos-mismo" },
    });
    await expect(equipo.bloquear(quien, otro.admin.usuarioId)).resolves.toMatchObject({
      error: { codigo: "usuario-inexistente" },
    });
    await expect(puedeEntrar(socia.email, CLAVE)).resolves.toBe(true);
  });
});
