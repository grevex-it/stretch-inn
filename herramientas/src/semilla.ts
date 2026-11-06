// Datos de prueba para desarrollo local: un centro con dos sedes y un admin con acceso total.
// Usa la conexión del dueño de la base, como las migraciones: es una herramienta, no la app.
// Mientras no exista el alta de centros desde soporte (0008), es la forma de poder entrar.
import {
  crearCatalogo,
  hashearClave,
  PERMISOS_IDENTIDAD,
  plantillasDelSistema,
} from "@app/identidad";
import { PERMISOS_PERSONAS } from "@app/personas";
import { randomUUID } from "node:crypto";
import pg from "pg";

export interface CuentaDePrueba {
  email: string;
  clave: string;
}

/** Los permisos de cada módulo: se suman al crear cada uno. */
const catalogo = crearCatalogo([PERMISOS_IDENTIDAD, PERMISOS_PERSONAS]);

async function crearCentro(cliente: pg.Client, cuenta: CuentaDePrueba): Promise<void> {
  const [centro, norte, sur, usuario, cuentaId] = Array.from({ length: 5 }, () => randomUUID());
  await cliente.query("insert into centros (id, nombre) values ($1, 'Centro de prueba')", [centro]);
  await cliente.query(
    `insert into sedes (id, centro_id, nombre, es_central)
     values ($2, $1, 'Norte', true), ($3, $1, 'Sur', false)`,
    [centro, norte, sur],
  );
  await cliente.query(
    `insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave)
     values ($1, $2, $3, false)`,
    [cuentaId, cuenta.email, await hashearClave(cuenta.clave)],
  );
  await cliente.query(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Admin de prueba')",
    [usuario, centro, cuentaId],
  );
  for (const plantilla of plantillasDelSistema(catalogo)) {
    const rol = randomUUID();
    await cliente.query("insert into roles (id, centro_id, nombre) values ($1, $2, $3)", [
      rol,
      centro,
      plantilla.nombre,
    ]);
    await cliente.query("insert into permisos_de_rol select $1, $2, unnest($3::text[])", [
      centro,
      rol,
      plantilla.permisos,
    ]);
    await cliente.query("insert into asignaciones values ($1, $2, $3, $5), ($1, $2, $4, $5)", [
      centro,
      usuario,
      norte,
      sur,
      rol,
    ]);
  }
}

/** Crea el centro de prueba. Si la cuenta ya existe, no toca nada. */
export async function sembrar(
  urlDueno: string,
  cuenta: CuentaDePrueba,
): Promise<{ creado: boolean }> {
  const cliente = new pg.Client({ connectionString: urlDueno });
  await cliente.connect();
  try {
    const existe = await cliente.query(
      "select 1 from plataforma.cuentas where lower(email) = lower($1)",
      [cuenta.email],
    );
    if (existe.rowCount !== 0) return { creado: false };
    await cliente.query("begin");
    await crearCentro(cliente, cuenta);
    await cliente.query("commit");
    return { creado: true };
  } catch (error) {
    await cliente.query("rollback");
    throw error;
  } finally {
    await cliente.end();
  }
}
