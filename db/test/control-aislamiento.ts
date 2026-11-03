// Control de aislamiento sobre el catálogo de Postgres (ver docs/decisiones/0002 y db/AGENTS.md).
import type pg from "pg";

/**
 * Tablas sin RLS activado, sin RLS forzado o sin ninguna política, entre:
 * - todas las de public, el esquema de los datos de los centros (tengan centro_id o no, como centros);
 * - las que tengan centro_id en cualquier otro esquema que no esté exceptuado.
 * Exceptuados: los del sistema, drizzle y pgboss (herramientas), logs (datos de la plataforma: su
 * centro_id es para filtrar, 0016) y plataforma (cuentas y sesiones, previas a elegir centro, 0017).
 */
const TABLAS_SIN_AISLAMIENTO = `
  select n.nspname || '.' || c.relname as tabla
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname not in ('pg_catalog', 'information_schema', 'drizzle', 'pgboss', 'logs', 'plataforma')
    and (n.nspname = 'public'
         or exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'centro_id' and not a.attisdropped))
    and (not c.relrowsecurity or not c.relforcerowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid))
  order by 1`;

export async function tablasSinAislamiento(cliente: pg.Client): Promise<string[]> {
  return (await cliente.query<{ tabla: string }>(TABLAS_SIN_AISLAMIENTO)).rows.map((f) => f.tabla);
}

/** Políticas de las mismas tablas, con sus expresiones tal como las guarda Postgres. */
const POLITICAS = `
  select p.schemaname || '.' || p.tablename || '.' || p.policyname as politica,
         p.qual, p.with_check,
         exists (select 1 from information_schema.columns col
                 where col.table_schema = p.schemaname and col.table_name = p.tablename
                   and col.column_name = 'centro_id') as tiene_centro,
         exists (select 1 from information_schema.columns col
                 where col.table_schema = p.schemaname and col.table_name = p.tablename
                   and col.column_name = 'sede_id') as tiene_sede
  from pg_policies p
  where p.schemaname not in ('pg_catalog', 'information_schema', 'drizzle', 'pgboss', 'logs', 'plataforma')
  order by 1`;

interface Politica {
  politica: string;
  qual: string | null;
  with_check: string | null;
  tiene_centro: boolean;
  tiene_sede: boolean;
}

/** OR, NOT o CASE pueden sumar filas fuera de la condición de centro. */
const ABRE = /\b(OR|NOT|CASE)\b/i;
const POR_CENTRO_ID = /centro_id = \( SELECT app_centro_actual\(\)/;
/** La tabla centros: su id es el centro. */
const POR_ID_DE_CENTRO = /(^|[^_])id = \( SELECT app_centro_actual\(\)/;
const POR_SEDE = /app_sedes_visibles\(\)|app_puede_ver_sede\(/;

function motivo({ qual, with_check, tiene_centro, tiene_sede }: Politica): string | undefined {
  const expresiones = [qual, with_check].filter((expr): expr is string => expr !== null);
  if (expresiones.some((expr) => ABRE.test(expr))) {
    return "usa OR, NOT o CASE: puede abrir más allá del centro";
  }
  const porCentro = tiene_centro ? POR_CENTRO_ID : POR_ID_DE_CENTRO;
  if (expresiones.length === 0 || expresiones.some((expr) => !porCentro.test(expr))) {
    return "no filtra por app_centro_actual()";
  }
  if (tiene_sede && expresiones.some((expr) => !POR_SEDE.test(expr))) {
    return "la tabla tiene sede_id y la política no filtra por sedes visibles";
  }
  return undefined;
}

/**
 * Políticas que no garantizan el aislamiento (R4 de la revisión). Cada una tiene que ser una
 * conjunción que incluya el centro del contexto y, si la tabla tiene sede_id, las sedes visibles.
 * Las políticas permisivas se combinan con OR, así que revisar cada una por separado alcanza.
 * Completa a los tests de comportamiento de cada módulo, no los reemplaza.
 */
export async function politicasInseguras(cliente: pg.Client): Promise<string[]> {
  const filas = (await cliente.query<Politica>(POLITICAS)).rows;
  return filas.flatMap((fila) => {
    const problema = motivo(fila);
    return problema === undefined ? [] : [`${fila.politica}: ${problema}`];
  });
}
