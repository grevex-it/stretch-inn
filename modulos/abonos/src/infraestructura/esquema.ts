// Tablas de los abonos. Las políticas de RLS y las claves hacia centros, sedes y alumnos van en
// una migración SQL (ver db/AGENTS.md): abonos no importa archivos internos de otro módulo.
// Montos en pesos enteros, `bigint` (0009).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Dinero } from "@app/nucleo";

const pesos = (nombre: string) => bigint(nombre, { mode: "number" }).$type<Dinero>();

/** Un plan del centro, con su precio general. */
export const planes = pgTable(
  "planes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    nombre: text("nombre").notNull(),
    /** Cuántas clases trae el paquete (0020): 4 el abono, 1 la clase suelta. */
    clases: smallint("clases").notNull().default(4),
    /** En desuso desde 0020: se borra en una migración posterior (dos pasos, db/AGENTS.md). */
    clasesPorSemana: smallint("clases_por_semana"),
    precio: pesos("precio").notNull(),
    activo: boolean("activo").notNull().default(true),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [
    index("planes_centro_nombre").on(tabla.centroId, tabla.nombre),
    check("planes_clases_del_paquete", sql`${tabla.clases} between 1 and 100`),
    check("planes_precio", sql`${tabla.precio} > 0`),
  ],
);

/** El precio propio de un plan en una sede (0011). Sin fila, la sede usa el general. */
export const preciosDeSede = pgTable(
  "precios_de_sede",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planes.id),
    precio: pesos("precio").notNull(),
  },
  (tabla) => [
    uniqueIndex("precios_de_sede_plan_sede").on(tabla.planId, tabla.sedeId),
    index("precios_de_sede_centro_sede").on(tabla.centroId, tabla.sedeId),
    check("precios_de_sede_precio", sql`${tabla.precio} > 0`),
  ],
);

/**
 * La cuota de un paquete de clases de un alumno (0020). El monto y las clases se congelan al
 * generarla. Anular no borra. Los abonos de un alumno no se pisan: lo controla la app con un
 * bloqueo por alumno, y el índice único es la última barrera.
 */
export const cuotas = pgTable(
  "cuotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planes.id),
    /** Desde qué día cuenta, en la zona del centro: cada fecha del horario fijo gasta una clase. */
    desde: date("desde", { mode: "string" }).notNull(),
    /** Cuántas clases trae, congeladas del plan al generarla. */
    clases: smallint("clases").notNull().default(4),
    /** En desuso desde 0020: se borra en una migración posterior (dos pasos, db/AGENTS.md). */
    hasta: date("hasta", { mode: "string" }),
    monto: pesos("monto").notNull(),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
    /** El pago de caja que la saldó. */
    pagoId: uuid("pago_id"),
    pagadaEn: timestamp("pagada_en", { withTimezone: true }),
    anuladaEn: timestamp("anulada_en", { withTimezone: true }),
  },
  (tabla) => [
    uniqueIndex("cuotas_alumno_desde_vigente")
      .on(tabla.alumnoId, tabla.desde)
      .where(sql`${tabla.anuladaEn} is null`),
    index("cuotas_centro_alumno_desde").on(tabla.centroId, tabla.alumnoId, tabla.desde),
    // Las impagas de una sede, la más vieja primero; y la última cuota de cada alumno.
    index("cuotas_sede_impagas")
      .on(tabla.centroId, tabla.sedeId, tabla.desde)
      .where(sql`${tabla.pagadaEn} is null and ${tabla.anuladaEn} is null`),
    index("cuotas_sede_alumno_desde").on(tabla.centroId, tabla.sedeId, tabla.alumnoId, tabla.desde),
    check("cuotas_clases", sql`${tabla.clases} between 1 and 100`),
    check("cuotas_monto", sql`${tabla.monto} > 0`),
    check("cuotas_pagada_o_anulada", sql`${tabla.pagadaEn} is null or ${tabla.anuladaEn} is null`),
  ],
);
