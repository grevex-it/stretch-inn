// Datos de prueba locales: después de sembrar, se puede entrar con esa cuenta de verdad.
import type {} from "@app/db/pruebas";
import { crearAcceso } from "@app/identidad";
import { crearBase, type Base } from "@app/plataforma";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { sembrar } from "../src/semilla.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const cuenta = { email: "admin@prueba.local", clave: "clave de prueba local" };

async function contar(tabla: string): Promise<number> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<{ n: string }>(`select count(*) as n from ${tabla}`);
    return Number(rows[0]?.n);
  } finally {
    await cliente.end();
  }
}

describe("sembrar", () => {
  it("crea un centro con dos sedes y un admin que entra con acceso a las dos", async () => {
    await expect(sembrar(inject("urlDueno"), cuenta)).resolves.toEqual({ creado: true });
    const acceso = crearAcceso(base);
    const ingreso = await acceso.entrar({ ...cuenta, origen: "127.0.0.1" });
    if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
    expect(ingreso.valor).toMatchObject({
      debeCambiarClave: false,
      centros: [{ nombre: "Centro de prueba" }],
    });
    const sesion = await acceso.resolver(ingreso.valor.token);
    if (sesion === undefined) throw new Error("sin sesión");
    expect((await acceso.sedes(sesion)).map((s) => s.nombre)).toEqual(["Norte", "Sur"]);
    // Acceso total: también los permisos de los módulos de negocio.
    for (const permisos of sesion.centro?.contexto.permisosPorSede.values() ?? []) {
      expect([...permisos]).toEqual(
        expect.arrayContaining(["personas.ver", "personas.editar", "agenda.gestionar"]),
      );
    }
  });

  it("el rol del admin sale de la plantilla Dueño, para recibir los permisos de módulos nuevos", async () => {
    const cliente = new pg.Client({ connectionString: inject("urlDueno") });
    await cliente.connect();
    try {
      const { rows } = await cliente.query<{ nombre: string; plantilla: string | null }>(
        "select nombre, plantilla from roles",
      );
      expect(rows).toEqual([{ nombre: "Dueño", plantilla: "dueno" }]);
    } finally {
      await cliente.end();
    }
  });

  it("si la cuenta ya existe no vuelve a crear nada", async () => {
    const centros = await contar("centros");
    await expect(sembrar(inject("urlDueno"), cuenta)).resolves.toEqual({ creado: false });
    expect(await contar("centros")).toBe(centros);
  });
});
