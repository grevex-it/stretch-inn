import pg from "pg";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { migrar } from "../src/migrar.ts";

const urlDueno = inject("urlDueno");
const urlApp = inject("urlApp");

async function consultar<Fila extends pg.QueryResultRow>(
  url: string,
  sql: string,
): Promise<Fila[]> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return (await cliente.query<Fila>(sql)).rows;
  } finally {
    await cliente.end();
  }
}

describe("migrar", () => {
  beforeAll(async () => {
    await migrar({ urlDueno, urlApp });
  });

  it("se puede correr dos veces sin efecto doble", async () => {
    await expect(migrar({ urlDueno, urlApp })).resolves.toBeUndefined();
  });

  it("crea app_usuario sin superusuario ni BYPASSRLS (0002)", async () => {
    const [rol] = await consultar<{ rolsuper: boolean; rolbypassrls: boolean }>(
      urlDueno,
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'app_usuario'",
    );
    expect(rol).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("le pone a app_usuario la clave de DATABASE_URL, así la app se puede conectar", async () => {
    const [fila] = await consultar<{ usuario: string }>(urlApp, "select current_user as usuario");
    expect(fila?.usuario).toBe("app_usuario");
  });

  it("app_usuario no puede cambiar el esquema", async () => {
    await expect(consultar(urlApp, "create table intrusa (id int)")).rejects.toThrow(
      /permission denied|permiso denegado/,
    );
  });
});
