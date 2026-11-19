// Permisos efectivos de una cuenta sobre Postgres real (ver docs/decisiones/0007 y 0017). Roles,
// asignaciones y ajustes: roles.integracion.test.ts y permisos-de-usuarios.integracion.test.ts.
import type {} from "@app/db/pruebas";
import { id, type ContextoCentro, type Permiso } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { cargarPermisos, crearCatalogo, PERMISOS_IDENTIDAD } from "../src/index.ts";

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
