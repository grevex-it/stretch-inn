// Conexión de la app a Postgres y transacciones con el contexto del centro (ver 0002).
import { sedesVisibles, type ContextoCentro } from "@app/nucleo";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

/**
 * Drizzle atado a la conexión de una transacción abierta. `$client` es esa conexión: la usa la
 * cola para guardar eventos en la misma transacción (outbox). Sin `transaction()`: una
 * transacción anidada sobre la misma conexión confirmaría la de afuera antes de tiempo.
 */
export type Transaccion = Omit<NodePgDatabase, "transaction"> & { $client: pg.PoolClient };

export interface Base {
  readonly db: NodePgDatabase;
  readonly pool: pg.Pool;
  cerrar(): Promise<void>;
}

export interface OpcionesBase {
  maximoConexiones?: number;
}

export function crearBase(url: string, opciones: OpcionesBase = {}): Base {
  const pool = new pg.Pool({ connectionString: url, max: opciones.maximoConexiones ?? 10 });
  return { db: drizzle(pool), pool, cerrar: () => pool.end() };
}

/** Falla si la base no responde. La usa el chequeo de salud. */
export async function comprobarBase(base: Base): Promise<void> {
  await base.pool.query("select 1");
}

/**
 * Falla si la conexión usa un rol que saltea RLS (superusuario o BYPASSRLS). Es la trampa del
 * Postgres de Railway: con su usuario por defecto el aislamiento parece andar y no protege nada.
 * Se llama al arrancar la app.
 */
export async function verificarRolSeguro(base: Base): Promise<void> {
  const filas = await base.db.execute<{ rol: string; saltea: boolean }>(
    sql`select current_user as rol, (rolsuper or rolbypassrls) as saltea
        from pg_roles where rolname = current_user`,
  );
  const fila = filas.rows[0];
  if (fila === undefined || fila.saltea) {
    throw new Error(
      `La conexión usa el rol "${fila?.rol ?? "?"}", que saltea RLS. La app tiene que usar app_usuario.`,
    );
  }
}

/**
 * Corre el trabajo en una transacción con el centro y las sedes visibles del contexto fijados
 * con SET LOCAL: vencen al terminar la transacción y no quedan en la conexión del pool.
 */
export async function enContexto<T>(
  base: Base,
  ctx: ContextoCentro,
  trabajo: (tx: Transaccion) => Promise<T>,
): Promise<T> {
  const cliente = await base.pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query(
      "select set_config('app.centro_id', $1, true), set_config('app.sedes', $2, true)",
      [ctx.centroId, `{${sedesVisibles(ctx).join(",")}}`],
    );
    const resultado = await trabajo(drizzle(cliente));
    await cliente.query("commit");
    return resultado;
  } catch (error) {
    await cliente.query("rollback");
    throw error;
  } finally {
    cliente.release();
  }
}
