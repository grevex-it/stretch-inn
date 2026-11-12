// Tablas de la caja. Las políticas de RLS y las claves hacia centros, sedes, alumnos y cuotas van
// en una migración SQL (ver db/AGENTS.md): caja no importa archivos internos de otro módulo.
// Montos en pesos enteros, `bigint` (0009).
import type { Dinero } from "@app/nucleo";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Medio } from "../dominio/cobro.ts";

/** Un pago de caja. La clave de idempotencia es única por centro (regla 7). Anular no borra. */
export const pagos = pgTable(
  "pagos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    cuotaId: uuid("cuota_id").notNull(),
    monto: bigint("monto", { mode: "number" }).$type<Dinero>().notNull(),
    medio: text("medio").$type<Medio>().notNull(),
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
    uniqueIndex("pagos_centro_clave").on(tabla.centroId, tabla.claveIdempotencia),
    index("pagos_centro_sede_registrado").on(tabla.centroId, tabla.sedeId, tabla.registradoEn),
    check("pagos_monto", sql`${tabla.monto} > 0`),
    check("pagos_medio", sql`${tabla.medio} in ('efectivo', 'transferencia')`),
    check("pagos_registrado_por", sql`${tabla.registradoPorTipo} in ('usuario', 'soporte')`),
    check(
      "pagos_anulacion",
      sql`(${tabla.anuladoEn} is null) = (${tabla.motivoAnulacion} is null)`,
    ),
  ],
);
