// Tablas de la asistencia. Las políticas de RLS y las claves hacia fechas y alumnos van en una
// migración SQL (ver db/AGENTS.md): asistencia no importa archivos internos de otro módulo.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
 * En desuso desde 0020: recuperar ya no pide un crédito por aviso. La tabla se borra en una
 * migración posterior (dos pasos, db/AGENTS.md).
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

/** Un lugar reservado para recuperar en una fecha (0020). Anular no borra. */
export const recuperaciones = pgTable(
  "recuperaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    /** La fecha en la que recupera. */
    ocurrenciaId: uuid("ocurrencia_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    /** Cuándo empieza la fecha en la que recupera: para contar las recuperaciones de un abono. */
    empiezaEn: timestamp("empieza_en", { withTimezone: true }),
    /** En desuso desde 0020: se borra en una migración posterior. */
    creditoId: uuid("credito_id"),
    reservadaPorTipo: text("reservada_por_tipo").$type<"usuario" | "soporte">().notNull(),
    reservadaPorId: uuid("reservada_por_id").notNull(),
    reservadaEn: timestamp("reservada_en", { withTimezone: true }).notNull(),
    anuladaEn: timestamp("anulada_en", { withTimezone: true }),
  },
  (tabla) => [
    // Un alumno recupera a lo sumo una vez por fecha.
    uniqueIndex("recuperaciones_credito_vigente")
      .on(tabla.creditoId)
      .where(sql`${tabla.anuladaEn} is null`),
    uniqueIndex("recuperaciones_ocurrencia_alumno_vigente")
      .on(tabla.ocurrenciaId, tabla.alumnoId)
      .where(sql`${tabla.anuladaEn} is null`),
    index("recuperaciones_centro_alumno").on(tabla.centroId, tabla.alumnoId),
    index("recuperaciones_alumno_sede_empieza").on(tabla.alumnoId, tabla.sedeId, tabla.empiezaEn),
    check("recuperaciones_reservada_por", sql`${tabla.reservadaPorTipo} in ('usuario', 'soporte')`),
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

/** Las reglas de recuperación de una sede (0020). Sin fila, valen las de por defecto. */
export const reglasDeRecuperacion = pgTable(
  "reglas_de_recuperacion",
  {
    sedeId: uuid("sede_id").primaryKey(),
    centroId: uuid("centro_id").notNull(),
    anticipacionMinutos: integer("anticipacion_minutos").notNull(),
    maximoPorAbono: integer("maximo_por_abono").notNull(),
    sinAbono: boolean("sin_abono").notNull(),
  },
  (tabla) => [
    check(
      "reglas_de_recuperacion_anticipacion",
      sql`${tabla.anticipacionMinutos} between 0 and 10080`,
    ),
    check("reglas_de_recuperacion_maximo", sql`${tabla.maximoPorAbono} between 0 and 100`),
  ],
);
