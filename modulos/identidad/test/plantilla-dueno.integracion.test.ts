// El rol que salió de la plantilla «Dueño» recibe los permisos de cada módulo nuevo por
// migración, en todos los centros, aunque el centro lo haya renombrado (0007: acceso total).
import type {} from "@app/db/pruebas";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, inject, it } from "vitest";

async function conectar(url: string): Promise<pg.Client> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  return cliente;
}

/** Como las migraciones: con el dueño del esquema. */
async function comoDueno<T extends pg.QueryResultRow>(
  consulta: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const cliente = await conectar(inject("urlDueno"));
  try {
    return (await cliente.query<T>(consulta, valores)).rows;
  } finally {
    await cliente.end();
  }
}

/** Un centro con su Dueño (renombrado) y un rol propio, cada uno con un permiso. */
async function centroConRoles(): Promise<{ dueno: string; propio: string }> {
  const centro = randomUUID();
  const dueno = randomUUID();
  const propio = randomUUID();
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno(
    `insert into roles (id, centro_id, nombre, plantilla)
     values ($2, $1, 'Dirección', 'dueno'), ($3, $1, 'Recepción', null)`,
    [centro, dueno, propio],
  );
  await comoDueno(
    "insert into permisos_de_rol values ($1, $2, 'usuarios.ver'), ($1, $3, 'usuarios.ver')",
    [centro, dueno, propio],
  );
  return { dueno, propio };
}

async function permisosDe(rol: string): Promise<string[]> {
  const filas = await comoDueno<{ permiso: string }>(
    "select permiso from permisos_de_rol where rol_id = $1 order by permiso",
    [rol],
  );
  return filas.map((fila) => fila.permiso);
}

describe("identidad_dar_al_dueno", () => {
  it("da los permisos al Dueño de cada centro y a ningún otro rol", async () => {
    const a = await centroConRoles();
    const b = await centroConRoles();

    await comoDueno("select identidad_dar_al_dueno(array['caja.cobrar', 'caja.ver'])");

    for (const centro of [a, b]) {
      expect(await permisosDe(centro.dueno)).toEqual(["caja.cobrar", "caja.ver", "usuarios.ver"]);
      expect(await permisosDe(centro.propio)).toEqual(["usuarios.ver"]);
    }
  });

  it("se puede correr dos veces sin efecto doble", async () => {
    const { dueno } = await centroConRoles();
    await comoDueno("select identidad_dar_al_dueno(array['caja.ver'])");
    await comoDueno("select identidad_dar_al_dueno(array['caja.ver', 'usuarios.ver'])");
    expect(await permisosDe(dueno)).toEqual(["caja.ver", "usuarios.ver"]);
  });

  it("la app no la puede llamar: es solo para migraciones", async () => {
    const cliente = await conectar(inject("urlApp"));
    try {
      await expect(
        cliente.query("select identidad_dar_al_dueno(array['caja.ver'])"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await cliente.end();
    }
  });

  it("solo se marca una plantilla conocida", async () => {
    const centro = randomUUID();
    await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
    await expect(
      comoDueno("insert into roles (centro_id, nombre, plantilla) values ($1, 'Otro', 'jefe')", [
        centro,
      ]),
    ).rejects.toThrow(/roles_plantilla/);
  });
});
