// Tablas de los profes (0024). Las políticas de RLS y las claves hacia centros, sedes y usuarios
// van en una migración SQL (ver db/AGENTS.md): profesores no importa archivos internos de otros
// módulos. Montos en pesos enteros, `bigint` (0009).
import type { Dinero } from "@app/nucleo";
import { sql } from "drizzle-orm";
import { bigint, check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { TipoDeProfe } from "../dominio/profe.ts";

/** El tipo de cada profe (un usuario del equipo). Sin fila, es empleado. */
export const tiposDeProfe = pgTable(
  "tipos_de_profe",
  {
    profeId: uuid("profe_id").primaryKey(),
    centroId: uuid("centro_id").notNull(),
    tipo: text("tipo").$type<TipoDeProfe>().notNull(),
  },
  (tabla) => [check("tipos_de_profe_tipo", sql`${tabla.tipo} in ('empleado', 'socio')`)],
);

const columnasDeTarifa = {
  id: uuid("id").primaryKey().defaultRandom(),
  centroId: uuid("centro_id").notNull(),
  /** null: para todos los profes. */
  profeId: uuid("profe_id"),
  monto: bigint("monto", { mode: "number" }).$type<Dinero>().notNull(),
  desde: date("desde", { mode: "string" }).notNull(),
  /** null mientras no la reemplace otra del mismo alcance. */
  hasta: date("hasta", { mode: "string" }),
};

/** Las tarifas de todo el centro: por profe, o para todos (el valor por defecto). */
export const tarifasDelCentro = pgTable("tarifas_del_centro", columnasDeTarifa, (tabla) => [
  index("tarifas_del_centro_centro_desde").on(tabla.centroId, tabla.desde),
  check("tarifas_del_centro_monto", sql`${tabla.monto} > 0`),
  check(
    "tarifas_del_centro_vigencia",
    sql`${tabla.hasta} is null or ${tabla.hasta} >= ${tabla.desde}`,
  ),
]);

/** Las tarifas de una sede: por profe en esa sede, o para todos en esa sede. */
export const tarifasDeSede = pgTable(
  "tarifas_de_sede",
  { ...columnasDeTarifa, sedeId: uuid("sede_id").notNull() },
  (tabla) => [
    index("tarifas_de_sede_centro_sede_desde").on(tabla.centroId, tabla.sedeId, tabla.desde),
    check("tarifas_de_sede_monto", sql`${tabla.monto} > 0`),
    check(
      "tarifas_de_sede_vigencia",
      sql`${tabla.hasta} is null or ${tabla.hasta} >= ${tabla.desde}`,
    ),
  ],
);
