// Roles a medida sobre Postgres real (0007): las plantillas no se editan, se duplican; nadie pone
// en un rol lo que no tiene, tampoco al editar uno que ya usan otros; un rol en uso no se borra.
import type {} from "@app/db/pruebas";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, crearRoles, type Acceso, type Roles } from "../src/index.ts";
import { comoDueno } from "./ayudas-acceso.ts";
import { contextoDe, entrarComo } from "./ayudas-equipo.ts";
import {
  CATALOGO,
  centroConPlantillas,
  persona,
  type CentroConPlantillas,
  type Persona,
} from "./ayudas-roles.ts";

let base: Base;
let acceso: Acceso;
let roles: Roles;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  acceso = crearAcceso(base);
  roles = crearRoles(base, { catalogo: CATALOGO });
});
afterAll(async () => {
  await base.cerrar();
});

async function como(quien: Persona): Promise<ContextoCentro> {
  return contextoDe((await entrarComo(acceso, quien.email)).sesion);
}

const error = (codigo: string) => ({ ok: false, error: { codigo } });

/** Un rol propio del centro, creado por el dueño. */
async function rolPropio(
  c: CentroConPlantillas,
  nombre: string,
  permisos: `${string}.${string}`[],
) {
  const creado = await roles.crearRol(await como(c.dueno), { nombre, permisos });
  if (!creado.ok) throw new Error(creado.error.mensaje);
  return creado.valor.id;
}

/** Le da roles.gestionar en Mendoza a la encargada, con un ajuste. */
async function encargadaQueArmaRoles(c: CentroConPlantillas) {
  await comoDueno("insert into ajustes values ($1, $2, $3, 'roles.gestionar', 'extra')", [
    c.centroId,
    c.encargada.usuarioId,
    c.mendoza,
  ]);
  return como(c.encargada);
}

describe("crear y duplicar", () => {
  it("duplicar una plantilla es crear un rol propio con sus permisos", async () => {
    const c = await centroConPlantillas();
    const lore = await como(c.dueno);
    const profesor = await roles.rol(lore, c.roles.profesor);
    if (!profesor.ok) throw new Error(profesor.error.mensaje);
    expect(profesor.valor).toMatchObject({ nombre: "Profesor", plantilla: "profesor", version: 1 });
    const sinCobrar = profesor.valor.permisos.filter((p) => p !== "caja.cobrar");
    const id = await rolPropio(c, "Profe sin caja", sinCobrar);
    expect(await roles.rol(lore, id)).toEqual({
      ok: true,
      valor: { id, nombre: "Profe sin caja", plantilla: null, permisos: sinCobrar, version: 1 },
    });
  });

  it("pide un nombre que no esté usado y permisos del catálogo", async () => {
    const c = await centroConPlantillas();
    const lore = await como(c.dueno);
    expect(await roles.crearRol(lore, { nombre: "profesor", permisos: [] })).toMatchObject(
      error("nombre-repetido"),
    );
    expect(await roles.crearRol(lore, { nombre: "Otro", permisos: ["gastos.ver"] })).toMatchObject(
      error("permiso-inexistente"),
    );
  });

  it("nadie pone en un rol lo que no tiene", async () => {
    const c = await centroConPlantillas();
    const eli = await encargadaQueArmaRoles(c);
    const rol = { nombre: "Con reglas", permisos: ["asistencia.configurar" as const] };
    expect(await roles.crearRol(eli, rol)).toMatchObject(error("permisos-ajenos"));
  });
});

describe("editar", () => {
  it("un rol propio cambia de nombre y permisos, y sube la versión", async () => {
    const c = await centroConPlantillas();
    const lore = await como(c.dueno);
    const id = await rolPropio(c, "Caja", ["caja.ver"]);
    const cambio = { id, nombre: "Cajero", permisos: ["caja.cobrar" as const], version: 1 };
    expect(await roles.editarRol(lore, cambio)).toEqual({ ok: true, valor: { version: 2 } });
    expect(await roles.rol(lore, id)).toMatchObject({
      ok: true,
      valor: { nombre: "Cajero", permisos: ["caja.cobrar"], version: 2 },
    });
    expect(await roles.editarRol(lore, cambio)).toMatchObject(error("cambio-concurrente"));
  });

  it("una plantilla no se edita: se duplica", async () => {
    const c = await centroConPlantillas();
    const cambio = { id: c.roles.profesor, nombre: "Profe", permisos: [], version: 1 };
    expect(await roles.editarRol(await como(c.dueno), cambio)).toMatchObject(
      error("rol-de-plantilla"),
    );
  });

  it("sumarle permisos a un rol en uso pide tenerlos en cada sede donde se usa", async () => {
    const c = await centroConPlantillas();
    const id = await rolPropio(c, "Ver", ["personas.ver"]);
    await persona(c.centroId, "Rita", [[c.rioTercero, id]]);
    const eli = await encargadaQueArmaRoles(c);
    const cambio = { id, nombre: "Ver", permisos: ["personas.ver" as const, "caja.ver" as const] };
    expect(await roles.editarRol(eli, { ...cambio, version: 1 })).toMatchObject(
      error("permisos-ajenos"),
    );
  });

  it("no deja al centro sin nadie con acceso total", async () => {
    const c = await centroConPlantillas();
    const id = await rolPropio(c, "Dirección", [...CATALOGO.todos]);
    const lucas = await persona(c.centroId, "Lucas", [
      [c.mendoza, id],
      [c.rioTercero, id],
    ]);
    const lore = await como(c.dueno);
    await comoDueno("delete from asignaciones where usuario_id = $1", [c.dueno.usuarioId]);
    const sinCaja = CATALOGO.todos.filter((p) => p !== "caja.ver");
    const cambio = { id, nombre: "Dirección", permisos: sinCaja, version: 1 };
    expect(await roles.editarRol(await como(lucas), cambio)).toMatchObject(
      error("ultimo-acceso-total"),
    );
    expect(await roles.rol(lore, id)).toMatchObject({ ok: true, valor: { version: 1 } });
  });
});

describe("borrar", () => {
  it("un rol propio sin asignar se borra", async () => {
    const c = await centroConPlantillas();
    const lore = await como(c.dueno);
    const id = await rolPropio(c, "Suelto", []);
    expect(await roles.borrarRol(lore, id)).toEqual({ ok: true, valor: null });
    expect(await roles.rol(lore, id)).toMatchObject(error("rol-inexistente"));
  });

  it("si alguien lo tiene, dice quiénes, también de las sedes que no ve", async () => {
    const c = await centroConPlantillas();
    const id = await rolPropio(c, "En uso", ["personas.ver"]);
    await persona(c.centroId, "Rita", [[c.rioTercero, id]]);
    await persona(c.centroId, "Ana", [[c.mendoza, id]]);
    const borrado = await roles.borrarRol(await encargadaQueArmaRoles(c), id);
    expect(borrado).toMatchObject(error("rol-en-uso"));
    expect(!borrado.ok && borrado.error.mensaje).toBe(
      "Lo tienen Ana y Rita: cambiales el rol antes de borrarlo.",
    );
  });

  it("una plantilla no se borra", async () => {
    const c = await centroConPlantillas();
    expect(await roles.borrarRol(await como(c.dueno), c.roles.recepcion)).toMatchObject(
      error("rol-de-plantilla"),
    );
  });
});
