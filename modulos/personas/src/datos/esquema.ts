// Tabla de alumnos. Las políticas de RLS y la clave hacia centros van en una migración SQL (ver
// db/AGENTS.md). El alumno es del centro, no de una sede (0011): sus inscripciones tendrán sede.
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const alumnos = pgTable(
  "alumnos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    nombre: text("nombre").notNull(),
    apellido: text("apellido").notNull(),
    /** El celular. Sin él, el alumno queda pendiente de completar (0022). */
    telefono: text("telefono"),
    /** Único en el centro. Sin él, el alta toma el siguiente. */
    numeroDeSocio: integer("numero_de_socio").notNull(),
    /** Sin puntos ni espacios. Si se carga, no se repite dentro del centro. */
    documento: text("documento"),
    email: text("email"),
    fechaNacimiento: date("fecha_nacimiento", { mode: "string" }),
    notas: text("notas").notNull().default(""),
    /** La «primera clase» (0019): para el regalo del año. */
    fechaDeInicio: date("fecha_de_inicio", { mode: "string" }),
    /**
     * Nombre, apellido, documento y dígitos del teléfono en minúsculas y sin acentos: lo que
     * compara el buscador. Lo arma la app en cada alta y edición.
     */
    busqueda: text("busqueda").notNull(),
    /** La baja no borra: oculta al alumno de la lista habitual y conserva su historia. */
    activo: boolean("activo").notNull().default(true),
    /** Cuándo se dio de baja; null si está activo. */
    bajaEn: timestamp("baja_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [
    uniqueIndex("alumnos_centro_documento")
      .on(tabla.centroId, tabla.documento)
      .where(sql`${tabla.documento} is not null`),
    uniqueIndex("alumnos_centro_socio").on(tabla.centroId, tabla.numeroDeSocio),
    index("alumnos_centro_apellido").on(tabla.centroId, tabla.apellido, tabla.nombre),
  ],
);

/**
 * Los datos de salud de un alumno (patologías), aparte de su ficha: se ven y se editan con
 * permisos propios (0019). Son datos sensibles (Ley 25.326): nunca van a un log.
 */
export const saludDeAlumnos = pgTable("salud_de_alumnos", {
  alumnoId: uuid("alumno_id")
    .primaryKey()
    .references(() => alumnos.id),
  centroId: uuid("centro_id").notNull(),
  patologias: text("patologias").notNull().default(""),
  version: integer("version").notNull().default(1),
});
