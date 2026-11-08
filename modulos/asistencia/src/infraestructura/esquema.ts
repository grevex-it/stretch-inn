// Tablas de la asistencia. Las políticas de RLS y las claves hacia fechas y alumnos van en una
// migración SQL (ver db/AGENTS.md): asistencia no importa archivos internos de otro módulo.
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** La marca de un alumno en una fecha. Corregirla la reemplaza: hay una por alumno y fecha. */
export const asistencias = pgTable(
  "asistencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    ocurrenciaId: uuid("ocurrencia_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    estado: text("estado").$type<"presente" | "ausente">().notNull(),
    /** De dónde vino la marca: hoy solo a mano; después, huella o cámara (0003). */
    origen: text("origen").$type<"manual">().notNull().default("manual"),
    registradaPorTipo: text("registrada_por_tipo").$type<"usuario" | "soporte">().notNull(),
    registradaPorId: uuid("registrada_por_id").notNull(),
    registradaEn: timestamp("registrada_en", { withTimezone: true }).notNull(),
  },
  (tabla) => [
    uniqueIndex("asistencias_ocurrencia_alumno").on(tabla.ocurrenciaId, tabla.alumnoId),
    index("asistencias_centro_alumno").on(tabla.centroId, tabla.alumnoId),
    check("asistencias_estado", sql`${tabla.estado} in ('presente', 'ausente')`),
    check("asistencias_origen", sql`${tabla.origen} in ('manual')`),
    check("asistencias_registrada_por", sql`${tabla.registradaPorTipo} in ('usuario', 'soporte')`),
  ],
);

/**
 * El derecho a recuperar que genera un aviso a tiempo, uno por aviso. Anularlo no lo borra.
 * Se usa en la sede de la fecha a la que se faltó.
 */
export const creditos = pgTable(
  "creditos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    avisoId: uuid("aviso_id").notNull(),
    /** La fecha a la que se faltó. */
    ocurrenciaId: uuid("ocurrencia_id").notNull(),
    venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  },
  (tabla) => [
    uniqueIndex("creditos_aviso").on(tabla.avisoId),
    index("creditos_centro_alumno_vence").on(tabla.centroId, tabla.alumnoId, tabla.venceEn),
  ],
);

/** El aviso de que un alumno no va a una fecha. Anularlo no lo borra: marca `anulado_en`. */
export const avisosDeAusencia = pgTable(
  "avisos_de_ausencia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    ocurrenciaId: uuid("ocurrencia_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    avisadoPorTipo: text("avisado_por_tipo").$type<"usuario" | "soporte">().notNull(),
    avisadoPorId: uuid("avisado_por_id").notNull(),
    avisadoEn: timestamp("avisado_en", { withTimezone: true }).notNull(),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  },
  (tabla) => [
    // Un aviso vigente por alumno y fecha.
    uniqueIndex("avisos_ocurrencia_alumno_vigente")
      .on(tabla.ocurrenciaId, tabla.alumnoId)
      .where(sql`${tabla.anuladoEn} is null`),
    index("avisos_centro_alumno").on(tabla.centroId, tabla.alumnoId),
    check("avisos_avisado_por", sql`${tabla.avisadoPorTipo} in ('usuario', 'soporte')`),
  ],
);
