// Alta y lista del equipo sobre Postgres real (ver docs/decisiones/0017).
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, crearEquipo, type Acceso, type Equipo } from "../src/index.ts";
import { CLAVE, centroConSedes, cuenta, rolCon, usuario } from "./ayudas-acceso.ts";
import { centroConEquipo, comoAdmin, contextoDe, entrarComo, integrante } from "./ayudas-equipo.ts";

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

const PRIMERA = { pagina: 1, porPagina: 50 };

describe("darDeAlta", () => {
  it("con un email nuevo crea la cuenta con una clave temporal que hay que cambiar", async () => {
    const c = await centroConEquipo();
    const quien = await comoAdmin(acceso, c);
    const email = `nueva-${c.centroId}@prueba.com`;

    const alta = await equipo.darDeAlta(quien, {
      nombre: " Ana ",
      email,
      rolId: c.recepcion,
      sedeIds: [c.norte],
    });
    if (!alta.ok) throw new Error(alta.error.mensaje);
    const { claveTemporal, usuarioId } = alta.valor;
    expect(claveTemporal).toMatch(/^\w{4}-\w{4}-\w{4}$/);

    const { sesion } = await entrarComo(acceso, email, { clave: claveTemporal ?? "" });
    expect(sesion.debeCambiarClave).toBe(true);
    const lista = await equipo.listar(quien, PRIMERA);
    expect(lista.elementos).toContainEqual({
      id: usuarioId,
      nombre: "Ana",
      email,
      activo: true,
      asignaciones: [{ sedeId: c.norte, rolId: c.recepcion, rol: "Recepción" }],
    });
  });

  it("con un email que ya tiene cuenta la vincula: entra con su clave de siempre", async () => {
    const c = await centroConEquipo();
    const otro = await centroConSedes("Otro centro", ["Única"]);
    const profe = await cuenta();
    await usuario(profe.cuentaId, otro, otro.sedeIds);

    const alta = await equipo.darDeAlta(await comoAdmin(acceso, c), {
      nombre: "Profe",
      email: profe.email.toUpperCase(),
      rolId: c.recepcion,
      sedeIds: [c.norte, c.sur],
    });

    expect(alta).toMatchObject({ ok: true, valor: { claveTemporal: null } });
    const ingreso = await acceso.entrar({ email: profe.email, clave: CLAVE, origen: "1.1.1.1" });
    expect(ingreso.ok && ingreso.valor.centros).toHaveLength(2);
  });

  it("no da de alta dos veces a la misma persona", async () => {
    const c = await centroConEquipo();
    const ana = await integrante(c, c.recepcion, [c.norte]);
    const alta = await equipo.darDeAlta(await comoAdmin(acceso, c), {
      nombre: "Ana otra vez",
      email: ana.email,
      rolId: c.recepcion,
      sedeIds: [c.norte],
    });
    expect(alta).toMatchObject({ ok: false, error: { codigo: "ya-es-del-equipo" } });
  });

  it("no deja dar un rol con permisos que no tiene en esa sede, y no crea nada", async () => {
    const c = await centroConEquipo();
    const gestor = await rolCon(c.centroId, "Gestor", [
      "usuarios.ver",
      "usuarios.gestionar",
      "caja.ver",
    ]);
    const encargada = await integrante(c, gestor, [c.norte]);
    const quien = contextoDe((await entrarComo(acceso, encargada.email)).sesion);
    const datos = { nombre: "Bea", email: `bea-${c.centroId}@prueba.com` };

    const enSur = await equipo.darDeAlta(quien, { ...datos, rolId: c.recepcion, sedeIds: [c.sur] });
    const duenio = await equipo.darDeAlta(quien, { ...datos, rolId: c.duenio, sedeIds: [c.norte] });

    expect(enSur).toMatchObject({ ok: false, error: { codigo: "permisos-ajenos" } });
    expect(duenio).toMatchObject({ ok: false, error: { codigo: "permisos-ajenos" } });
    expect((await equipo.listar(quien, PRIMERA)).total).toBe(2);
    const ingreso = await acceso.entrar({ email: datos.email, clave: "x", origen: "2.2.2.2" });
    expect(ingreso.ok).toBe(false);
  });

  it("un rol de otro centro no existe", async () => {
    const c = await centroConEquipo();
    const otro = await centroConEquipo("Otro");
    const alta = await equipo.darDeAlta(await comoAdmin(acceso, c), {
      nombre: "Bea",
      email: `bea-${c.centroId}@prueba.com`,
      rolId: otro.recepcion,
      sedeIds: [c.norte],
    });
    expect(alta).toMatchObject({ ok: false, error: { codigo: "rol-inexistente" } });
  });

  it("pide nombre y al menos una sede", async () => {
    const c = await centroConEquipo();
    const quien = await comoAdmin(acceso, c);
    const datos = { email: `x-${c.centroId}@prueba.com`, rolId: c.recepcion };
    await expect(
      equipo.darDeAlta(quien, { ...datos, nombre: " ", sedeIds: [c.norte] }),
    ).resolves.toMatchObject({ ok: false, error: { codigo: "nombre-vacio" } });
    await expect(
      equipo.darDeAlta(quien, { ...datos, nombre: "X", sedeIds: [] }),
    ).resolves.toMatchObject({ ok: false, error: { codigo: "sin-sedes" } });
  });
});

describe("listar y roles", () => {
  it("pagina el equipo, ordenado por nombre, y solo el del propio centro", async () => {
    const c = await centroConEquipo();
    await centroConEquipo("Otro");
    await integrante(c, c.recepcion, [c.norte]);
    const quien = await comoAdmin(acceso, c);

    const segunda = await equipo.listar(quien, { pagina: 2, porPagina: 1 });

    expect(segunda).toMatchObject({ pagina: 2, porPagina: 1, total: 2 });
    expect(segunda.elementos).toHaveLength(1);
  });

  it("con una sede activa muestra solo las asignaciones de esa sede", async () => {
    const c = await centroConEquipo();
    const quien = await comoAdmin(acceso, c, c.norte);
    const lista = await equipo.listar(quien, PRIMERA);
    expect(lista.elementos[0]?.asignaciones.map((a) => a.sedeId)).toEqual([c.norte]);
  });

  it("lista los roles del centro, por nombre", async () => {
    const c = await centroConEquipo();
    const roles = await equipo.roles(await comoAdmin(acceso, c), PRIMERA);
    expect(roles).toMatchObject({ total: 2 });
    expect(roles.elementos.map((r) => r.nombre)).toEqual(["Dueño", "Recepción"]);
  });
});
