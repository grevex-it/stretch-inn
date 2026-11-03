// Tablas de centros y sedes. Las políticas de RLS van en una migración SQL (ver db/AGENTS.md).
import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const centros = pgTable("centros", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  /** Zona horaria en la que se muestran las fechas del centro (0010). */
  zonaHoraria: text("zona_horaria").notNull().default("America/Argentina/Buenos_Aires"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

export const sedes = pgTable(
  "sedes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id")
      .notNull()
      .references(() => centros.id),
    nombre: text("nombre").notNull(),
    /** La sede central encabeza reportes consolidados; no da permisos por sí misma (0007). */
    esCentral: boolean("es_central").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [
    uniqueIndex("sedes_centro_nombre").on(tabla.centroId, tabla.nombre),
    uniqueIndex("sedes_una_central")
      .on(tabla.centroId)
      .where(sql`${tabla.esCentral}`),
  ],
);
