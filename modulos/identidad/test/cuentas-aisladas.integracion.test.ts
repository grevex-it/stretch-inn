// Las cuentas son de toda la plataforma (0017): la app no las lee ni las escribe directo. Solo pasa
// por las funciones de alcance mínimo, que devuelven lo indispensable.
import pg from "pg";
import { describe, expect, inject, it } from "vitest";

async function comoApp(consulta: string): Promise<unknown> {
  const cliente = new pg.Client({ connectionString: inject("urlApp") });
  await cliente.connect();
  try {
    return await cliente.query(consulta);
  } finally {
    await cliente.end();
  }
}

describe("la tabla de cuentas", () => {
  it.each([
    ["leer", "select email from plataforma.cuentas"],
    ["crear", "insert into plataforma.cuentas (email, hash_clave) values ('x@x.com', 'x')"],
    ["cambiar", "update plataforma.cuentas set hash_clave = 'x'"],
  ])("la app no puede %s cuentas directo", async (_accion, consulta) => {
    await expect(comoApp(consulta)).rejects.toThrow(/permission denied/);
  });
});
