// Tablas de los gastos. Las políticas de RLS y las claves hacia centros y sedes van en una
// migración SQL (ver db/AGENTS.md). Montos en pesos enteros, `bigint` (0009).
import type { Dinero } from "@app/nucleo";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Categoria, MedioDeGasto } from "../dominio/gasto.ts";

/** Un gasto de una sede. La clave de idempotencia es única por centro (regla 7). Anular no borra. */
export const gastos = pgTable(
  "gastos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    /** El día del gasto, en la zona del centro. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    monto: bigint("monto", { mode: "number" }).$type<Dinero>().notNull(),
    categoria: text("categoria").$type<Categoria>().notNull(),
    medio: text("medio").$type<MedioDeGasto>().notNull(),
    descripcion: text("descripcion").notNull().default(""),
    claveIdempotencia: text("clave_idempotencia").notNull(),
    registradoPorTipo: text("registrado_por_tipo").$type<"usuario" | "soporte">().notNull(),
    registradoPorId: uuid("registrado_por_id").notNull(),
    registradoEn: timestamp("registrado_en", { withTimezone: true }).notNull(),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPorTipo: text("anulado_por_tipo").$type<"usuario" | "soporte">(),
    anuladoPorId: uuid("anulado_por_id"),
    motivoAnulacion: text("motivo_anulacion"),
  },
  (tabla) => [
    uniqueIndex("gastos_centro_clave").on(tabla.centroId, tabla.claveIdempotencia),
    index("gastos_centro_sede_fecha").on(tabla.centroId, tabla.sedeId, tabla.fecha),
    check("gastos_monto", sql`${tabla.monto} > 0`),
    check("gastos_medio", sql`${tabla.medio} in ('efectivo', 'transferencia')`),
    check("gastos_registrado_por", sql`${tabla.registradoPorTipo} in ('usuario', 'soporte')`),
    check(
      "gastos_anulacion",
      sql`(${tabla.anuladoEn} is null) = (${tabla.motivoAnulacion} is null)`,
    ),
  ],
);
