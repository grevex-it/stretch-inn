// Casos de uso de roles y permisos sobre Postgres real (ver docs/decisiones/0007 y 0017).
import type {} from "@app/db/pruebas";
import { id, type ContextoCentro, type Permiso } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  ajustarPermiso,
  asignarRol,
  cargarPermisos,
  crearCatalogo,
  crearRol,
  PERMISOS_IDENTIDAD,
  quitarAsignacion,
} from "../src/index.ts";

const catalogo = crearCatalogo([
  PERMISOS_IDENTIDAD,
  {
    seccion: "Caja",
    permisos: [
      { permiso: "caja.ver", descripcion: "Ver" },
      { permiso: "caja.cobrar", descripcion: "Cobrar" },
    ],
  },
]);

let base: Base;

beforeAll(() => {
  base = crearBase(inject("urlApp"));
});

afterAll(async () => {
  await base.cerrar();
});

async function comoDueno(consulta: string, valores: unknown[] = []): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  await cliente.query(consulta, valores);
  await cliente.end();
}

/** Un centro con dos sedes, un admin con el rol Dueño en las dos y una persona sin roles. */
async function centroDePrueba() {
  const [centro, norte, sur, rolDuenio] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [cuentaAdmin, admin, cuentaAna, ana] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno(
    "insert into sedes (id, centro_id, nombre) values ($2, $1, 'Norte'), ($3, $1, 'Sur')",
    [centro, norte, sur],
  );
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave) values ($1, $2, 'x'), ($3, $4, 'x')",
    [cuentaAdmin, `${cuentaAdmin}@prueba`, cuentaAna, `${cuentaAna}@prueba`],
  );
  await comoDueno(
    `insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Admin'), ($4, $2, $5, 'Ana')`,
    [admin, centro, cuentaAdmin, ana, cuentaAna],
  );
  await comoDueno(`insert into roles (id, centro_id, nombre) values ($1, $2, 'Dueño')`, [
    rolDuenio,
    centro,
  ]);
  for (const permiso of catalogo.todos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [
      centro,
      rolDuenio,
      permiso,
    ]);
  }
  await comoDueno("insert into asignaciones values ($1, $2, $3, $4), ($1, $2, $5, $4)", [
    centro,
    admin,
    norte,
    rolDuenio,
    sur,
  ]);
  return { centro, norte, sur, rolDuenio, cuentaAdmin, admin, cuentaAna, ana };
}

type Centro = Awaited<ReturnType<typeof centroDePrueba>>;

async function contextoDe(c: Centro, cuenta: string): Promise<ContextoCentro> {
  const permisosPorSede = await enContexto(
    base,
    {
      centroId: id<"Centro">(c.centro),
      actor: { tipo: "usuario", usuarioId: id<"Usuario">(cuenta) },
      permisosPorSede: new Map(),
    },
    (tx) => cargarPermisos(tx, cuenta, c.centro),
  );
  return {
    centroId: id<"Centro">(c.centro),
    actor: { tipo: "usuario", usuarioId: id<"Usuario">(cuenta) },
    permisosPorSede,
  };
}

function lista(ctx: ContextoCentro, sede: string): Permiso[] {
  return [...(ctx.permisosPorSede.get(id<"Sede">(sede)) ?? [])].sort();
}

describe("cargarPermisos", () => {
  it("calcula roles + extras − quitados de la cuenta en ese centro", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    expect(lista(admin, c.norte)).toEqual([...catalogo.todos].sort());
    expect(lista(await contextoDe(c, c.cuentaAna), c.norte)).toEqual([]);
  });

  it("no mezcla centros: la misma cuenta no trae permisos de otro centro", async () => {
    const a = await centroDePrueba();
    const b = await centroDePrueba();
    const enB = await contextoDe(b, a.cuentaAdmin);
    expect([...enB.permisosPorSede.keys()]).toEqual([]);
  });
});

describe("crearRol y asignarRol", () => {
  it("crea un rol, lo asigna en una sede y el permiso aparece solo en esa sede", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    const rol = await enContexto(base, admin, (tx) =>
      crearRol(tx, admin, { nombre: "Recepción", permisos: ["caja.ver", "caja.cobrar"] }),
    );
    if (!rol.ok) throw new Error(rol.error.mensaje);
    const asignado = await enContexto(base, admin, (tx) =>
      asignarRol(tx, admin, { usuarioId: c.ana, sedeId: c.norte, rolId: rol.valor.id }),
    );
    expect(asignado.ok).toBe(true);
    const ana = await contextoDe(c, c.cuentaAna);
    expect(lista(ana, c.norte)).toEqual(["caja.cobrar", "caja.ver"]);
    expect(lista(ana, c.sur)).toEqual([]);
  });

  it("nadie da permisos que no tiene (0007, regla 1)", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    const cajero = await enContexto(base, admin, (tx) =>
      crearRol(tx, admin, { nombre: "Cajero", permisos: ["caja.ver", "usuarios.gestionar"] }),
    );
    if (!cajero.ok) throw new Error(cajero.error.mensaje);
    await enContexto(base, admin, (tx) =>
      asignarRol(tx, admin, { usuarioId: c.ana, sedeId: c.norte, rolId: cajero.valor.id }),
    );
    const ana = await contextoDe(c, c.cuentaAna);

    const rolConMas = await enContexto(base, ana, (tx) =>
      crearRol(tx, ana, { nombre: "Más", permisos: ["caja.cobrar"] }),
    );
    expect(rolConMas).toMatchObject({ ok: false, error: { codigo: "permisos-ajenos" } });
    const enOtraSede = await enContexto(base, ana, (tx) =>
      ajustarPermiso(
        tx,
        ana,
        { usuarioId: c.ana, sedeId: c.sur, permiso: "caja.ver", tipo: "extra" },
        catalogo,
      ),
    );
    expect(enOtraSede).toMatchObject({ ok: false, error: { codigo: "permisos-ajenos" } });
  });

  it("no permite dos roles con el mismo nombre en el centro", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    const repetido = await enContexto(base, admin, (tx) =>
      crearRol(tx, admin, { nombre: "Dueño", permisos: ["caja.ver"] }),
    );
    expect(repetido).toMatchObject({ ok: false, error: { codigo: "nombre-repetido" } });
  });

  it("no asigna un rol de otro centro", async () => {
    const a = await centroDePrueba();
    const b = await centroDePrueba();
    const adminA = await contextoDe(a, a.cuentaAdmin);
    const resultado = await enContexto(base, adminA, (tx) =>
      asignarRol(tx, adminA, { usuarioId: a.ana, sedeId: a.norte, rolId: b.rolDuenio }),
    );
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "rol-inexistente" } });
  });
});

describe("siempre queda alguien con acceso total (0007, regla 2)", () => {
  it("no deja quitarle el rol al último usuario con acceso total, y no cambia nada", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    const resultado = await enContexto(base, admin, (tx) =>
      quitarAsignacion(tx, { usuarioId: c.admin, sedeId: c.sur, rolId: c.rolDuenio }, catalogo),
    );
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "ultimo-acceso-total" } });
    expect(lista(await contextoDe(c, c.cuentaAdmin), c.sur)).toEqual([...catalogo.todos].sort());
  });

  it("tampoco deja quitárselo con un ajuste", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    const resultado = await enContexto(base, admin, (tx) =>
      ajustarPermiso(
        tx,
        admin,
        { usuarioId: c.admin, sedeId: c.norte, permiso: "caja.ver", tipo: "quitado" },
        catalogo,
      ),
    );
    expect(resultado).toMatchObject({ ok: false, error: { codigo: "ultimo-acceso-total" } });
    expect(lista(await contextoDe(c, c.cuentaAdmin), c.norte)).toContain("caja.ver");
  });

  it("sí deja si queda otro usuario con acceso total", async () => {
    const c = await centroDePrueba();
    const admin = await contextoDe(c, c.cuentaAdmin);
    for (const sede of [c.norte, c.sur]) {
      await enContexto(base, admin, (tx) =>
        asignarRol(tx, admin, { usuarioId: c.ana, sedeId: sede, rolId: c.rolDuenio }),
      );
    }
    const resultado = await enContexto(base, admin, (tx) =>
      quitarAsignacion(tx, { usuarioId: c.admin, sedeId: c.sur, rolId: c.rolDuenio }, catalogo),
    );
    expect(resultado.ok).toBe(true);
  });
});
