// Esquema de la cola persistente (pg-boss, ver docs/decisiones/0004). Lo instala y actualiza el
// dueño del esquema al migrar; la app solo lo usa, sin poder cambiar su estructura.
import { PgBoss } from "pg-boss";
import type pg from "pg";

const ESQUEMA_COLA = "pgboss";

export async function instalarCola(urlDueno: string, cliente: pg.Client): Promise<void> {
  const boss = new PgBoss({
    connectionString: urlDueno,
    schema: ESQUEMA_COLA,
    supervise: false,
    schedule: false,
  });
  await boss.start();
  await boss.stop({ graceful: false });

  // Se repite en cada migración: cubre las tablas que sume una versión nueva de pg-boss.
  await cliente.query(`
    grant usage on schema ${ESQUEMA_COLA} to app_usuario;
    grant select, insert, update, delete on all tables in schema ${ESQUEMA_COLA} to app_usuario;
    grant usage, select on all sequences in schema ${ESQUEMA_COLA} to app_usuario;
    grant execute on all functions in schema ${ESQUEMA_COLA} to app_usuario;`);
}
