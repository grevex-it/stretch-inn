// Datos de prueba: centros con un usuario que entra de verdad, para que el contexto salga de una
// sesión real (regla 1 de AGENTS.md: nunca se arma a mano).
import type {} from "@app/db/pruebas";
import { crearAcceso, hashearClave } from "@app/identidad";
import type { ContextoCentro } from "@app/nucleo";
import type { Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";

const CLAVE = "una clave bien larga";

async function comoDueno(consulta: string, valores: unknown[] = []): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    await cliente.query(consulta, valores);
  } finally {
    await cliente.end();
  }
}

/** Un centro con una sede y una persona con esos permisos en ella. Devuelve su contexto real. */
export async function contextoConPermisos(base: Base, permisos: string[]): Promise<ContextoCentro> {
  const [centro, sede, rol, cuenta, usuario] = Array.from({ length: 5 }, () => randomUUID());
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno("insert into sedes (id, centro_id, nombre) values ($1, $2, 'Única')", [
    sede,
    centro,
  ]);
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, 'Rol')", [
    rol,
    centro,
  ]);
  for (const permiso of permisos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [centro, rol, permiso]);
  }
  const email = `${cuenta}@prueba.com`;
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, $3, false)",
    [cuenta, email, await hashearClave(CLAVE)],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Ana')",
    [usuario, centro, cuenta],
  );
  await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [centro, usuario, sede, rol]);
  const acceso = crearAcceso(base);
  const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: randomUUID() });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const sesion = await acceso.resolver(ingreso.valor.token);
  if (sesion?.centro == null) throw new Error("La sesión no quedó en el centro.");
  return sesion.centro.contexto;
}

export const ANA = {
  nombre: "Ana",
  apellido: "Pérez",
  telefono: "11 5555-1234",
  documento: null,
  email: null,
  fechaNacimiento: null,
  notas: "",
};
