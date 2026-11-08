// Datos de prueba: un centro con dos sedes (Norte y Sur) y personas que entran de verdad, con
// permisos distintos en cada sede. El contexto sale de una sesión real (regla 1 de AGENTS.md).
import type {} from "@app/db/pruebas";
import { crearAcceso, hashearClave } from "@app/identidad";
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";

const CLAVE = "una clave bien larga";

const TODO = [
  "abonos.ver",
  "abonos.gestionar",
  "abonos.asignar",
  "personas.ver",
  "personas.editar",
];

async function comoDueno(consulta: string, valores: unknown[] = []): Promise<void> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    await cliente.query(consulta, valores);
  } finally {
    await cliente.end();
  }
}

async function rolCon(centro: string, permisos: readonly string[]): Promise<string> {
  const rol = randomUUID();
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, $3)", [
    rol,
    centro,
    `Rol ${rol}`,
  ]);
  for (const permiso of permisos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [centro, rol, permiso]);
  }
  return rol;
}

async function persona(
  base: Base,
  centro: string,
  sedes: readonly (readonly [string, readonly string[]])[],
): Promise<ContextoCentro> {
  const [cuenta, usuario] = [randomUUID(), randomUUID()];
  const email = `${cuenta}@prueba.com`;
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, $3, false)",
    [cuenta, email, await hashearClave(CLAVE)],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Ana')",
    [usuario, centro, cuenta],
  );
  for (const [sede, permisos] of sedes) {
    if (permisos.length === 0) continue;
    const rol = await rolCon(centro, permisos);
    await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [
      centro,
      usuario,
      sede,
      rol,
    ]);
  }
  const acceso = crearAcceso(base);
  const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: randomUUID() });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const sesion = await acceso.resolver(ingreso.valor.token);
  if (sesion?.centro == null) throw new Error("La sesión no quedó en el centro.");
  return sesion.centro.contexto;
}

/**
 * Un centro con Norte y Sur y una persona con todos los permisos en las dos (`ctx`). `otra`
 * arma otra persona del mismo centro con los permisos que se le pasen por sede.
 */
export async function centroConDosSedes(base: Base) {
  const centro = randomUUID();
  const [norte, sur] = [randomUUID(), randomUUID()];
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno(
    "insert into sedes (id, centro_id, nombre) values ($1, $3, 'Norte'), ($2, $3, 'Sur')",
    [norte, sur, centro],
  );
  const ctx = await persona(base, centro, [
    [norte, TODO],
    [sur, TODO],
  ]);
  const alumno = async (nombre = "Ana") => {
    const alta = await enContexto(base, ctx, (tx) =>
      crearAlumno(tx, {
        nombre,
        apellido: "Prueba",
        telefono: "11 5555-1234",
        documento: null,
        email: null,
        fechaNacimiento: null,
        notas: "",
      }),
    );
    if (!alta.ok) throw new Error(alta.error.mensaje);
    return alta.valor.id;
  };
  return {
    ctx,
    norte,
    sur,
    alumno,
    otra: (permisos: { norte: readonly string[]; sur: readonly string[] }) =>
      persona(base, centro, [
        [norte, permisos.norte],
        [sur, permisos.sur],
      ]),
  };
}
