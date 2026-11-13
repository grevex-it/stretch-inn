// Lo que identidad les da a otros módulos: los usuarios del equipo del centro, para mostrar y
// validar un profe (0022) sin leer las tablas de identidad (regla 4). Sobre Postgres real, con RLS.
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, obtenerUsuarios, type Acceso } from "../src/index.ts";
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
