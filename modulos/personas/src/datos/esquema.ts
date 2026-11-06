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
    telefono: text("telefono").notNull(),
    /** Sin puntos ni espacios. Si se carga, no se repite dentro del centro. */
    documento: text("documento"),
    email: text("email"),
    fechaNacimiento: date("fecha_nacimiento", { mode: "string" }),
    notas: text("notas").notNull().default(""),
    /**
     * Nombre, apellido, documento y dígitos del teléfono en minúsculas y sin acentos: lo que
     * compara el buscador. Lo arma la app en cada alta y edición.
     */
    busqueda: text("busqueda").notNull(),
    /** La baja no borra: oculta al alumno de la lista habitual y conserva su historia. */
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [
    uniqueIndex("alumnos_centro_documento")
      .on(tabla.centroId, tabla.documento)
      .where(sql`${tabla.documento} is not null`),
    index("alumnos_centro_apellido").on(tabla.centroId, tabla.apellido, tabla.nombre),
  ],
);
