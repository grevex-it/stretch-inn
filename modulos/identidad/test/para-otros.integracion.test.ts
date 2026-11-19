// Lo que identidad les da a otros módulos: los usuarios del equipo del centro, para elegir, mostrar
// y validar un profe (0022) sin leer las tablas de identidad (regla 4). Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, listarUsuariosActivos, obtenerUsuarios, type Acceso } from "../src/index.ts";
import { comoDueno } from "./ayudas-acceso.ts";
import { centroConEquipo, comoAdmin, integrante } from "./ayudas-equipo.ts";

let base: Base;
let acceso: Acceso;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  acceso = crearAcceso(base);
});
afterAll(async () => {
  await base.cerrar();
});

describe("obtenerUsuarios", () => {
  it("trae nombre y si está activo; los de otro centro o inexistentes no vuelven", async () => {
    const c = await centroConEquipo();
    const otro = await centroConEquipo("Otro");
    const lore = await integrante(c, c.recepcion, [c.norte]);
    await comoDueno("update usuarios set nombre = 'Lore', activo = false where id = $1", [
      lore.usuarioId,
    ]);
    const ctx = await comoAdmin(acceso, c);

    const usuarios = await enContexto(base, ctx, (tx) =>
      obtenerUsuarios(tx, [lore.usuarioId, otro.admin.usuarioId, randomUUID()]),
    );

    expect(usuarios).toEqual([{ id: lore.usuarioId, nombre: "Lore", activo: false }]);
  });

  it("sin ids no consulta; con más de 100 falla", async () => {
    const c = await centroConEquipo();
    const ctx = await comoAdmin(acceso, c);

    expect(await enContexto(base, ctx, (tx) => obtenerUsuarios(tx, []))).toEqual([]);
    const muchos = Array.from({ length: 101 }, () => randomUUID());
    await expect(enContexto(base, ctx, (tx) => obtenerUsuarios(tx, muchos))).rejects.toThrow(
      "hasta 100",
    );
  });
});

describe("listarUsuariosActivos", () => {
  it("los activos del centro por nombre, de a una página; ni bloqueados ni de otro centro", async () => {
    const c = await centroConEquipo();
    await centroConEquipo("Otro");
    const nombrar = (usuarioId: string, nombre: string, activo = true) =>
      comoDueno("update usuarios set nombre = $2, activo = $3 where id = $1", [
        usuarioId,
        nombre,
        activo,
      ]);
    const bea = await integrante(c, c.recepcion, [c.norte]);
    const ana = await integrante(c, c.recepcion, [c.sur]);
    const caro = await integrante(c, c.recepcion, [c.norte]);
    await nombrar(c.admin.usuarioId, "Lore");
    await nombrar(bea.usuarioId, "Bea");
    await nombrar(ana.usuarioId, "Ana", false);
    await nombrar(caro.usuarioId, "Caro");
    const ctx = await comoAdmin(acceso, c);

    const listar = (pagina: number, porPagina: number) =>
      enContexto(base, ctx, (tx) => listarUsuariosActivos(tx, { pagina, porPagina }));

    const todos = await listar(1, 50);
    const nombres = todos.elementos.map((u) => u.nombre);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b)));
    expect(nombres).toEqual(expect.arrayContaining(["Bea", "Caro", "Lore"]));
    expect(nombres).not.toContain("Ana");
    expect(todos.total).toBe(nombres.length);
    expect(todos.elementos[0]).toEqual({ id: bea.usuarioId, nombre: "Bea" });

    const segunda = await listar(2, 1);
    expect([segunda.total, segunda.elementos]).toEqual([
      nombres.length,
      [{ id: caro.usuarioId, nombre: "Caro" }],
    ]);
  });
});
