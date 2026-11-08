// Tablas de la agenda. Las políticas de RLS y las claves hacia centros y sedes van en una
// migración SQL (ver db/AGENTS.md): agenda no importa archivos internos de otro módulo.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Una clase semanal de una sede, en la hora local del centro. */
export const clases = pgTable(
  "clases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    nombre: text("nombre").notNull(),
    /** 1 = lunes … 7 = domingo. */
    dia: smallint("dia").notNull(),
    /** Hora local de inicio, HH:MM. */
    hora: text("hora").notNull(),
    duracionMinutos: integer("duracion_minutos").notNull(),
    cupo: integer("cupo").notNull(),
    /**
     * Inscripciones vigentes. Se suma y resta en la misma transacción que la inscripción, con la
     * clase bloqueada; la restricción `clases_inscriptos` es la última barrera del cupo (0013).
     */
    inscriptos: integer("inscriptos").notNull().default(0),
    /** La baja no borra: deja de tener fechas nuevas y conserva las pasadas. */
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [
    // Para que cada ocurrencia quede en el mismo centro y la misma sede que su clase.
    unique("clases_id_centro_sede").on(tabla.id, tabla.centroId, tabla.sedeId),
    index("clases_centro_sede_dia_hora").on(tabla.centroId, tabla.sedeId, tabla.dia, tabla.hora),
    check("clases_dia", sql`${tabla.dia} between 1 and 7`),
    check("clases_hora", sql`${tabla.hora} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check("clases_duracion", sql`${tabla.duracionMinutos} between 15 and 240`),
    check("clases_cupo", sql`${tabla.cupo} between 1 and 500`),
    check("clases_inscriptos", sql`${tabla.inscriptos} between 0 and ${tabla.cupo}`),
  ],
);

/** Un alumno con lugar fijo en una clase semanal. La baja no borra: marca `baja_en`. */
export const inscripciones = pgTable(
  "inscripciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    claseId: uuid("clase_id").notNull(),
    alumnoId: uuid("alumno_id").notNull(),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
    bajaEn: timestamp("baja_en", { withTimezone: true }),
  },
  (tabla) => [
    // Un alumno no tiene dos inscripciones vigentes en la misma clase.
    uniqueIndex("inscripciones_clase_alumno_vigente")
      .on(tabla.claseId, tabla.alumnoId)
      .where(sql`${tabla.bajaEn} is null`),
    index("inscripciones_centro_alumno").on(tabla.centroId, tabla.alumnoId),
    foreignKey({
      name: "inscripciones_clase",
      columns: [tabla.claseId, tabla.centroId, tabla.sedeId],
      foreignColumns: [clases.id, clases.centroId, clases.sedeId],
    }),
  ],
);

/** Una fecha concreta de una clase. Se arma a pedido al consultar una semana. */
export const ocurrencias = pgTable(
  "ocurrencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    sedeId: uuid("sede_id").notNull(),
    claseId: uuid("clase_id").notNull(),
    /** La fecha local del centro. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    empiezaEn: timestamp("empieza_en", { withTimezone: true }).notNull(),
    terminaEn: timestamp("termina_en", { withTimezone: true }).notNull(),
    /** Feriado, profesor enfermo: queda marcada, no se borra. */
    cancelada: boolean("cancelada").notNull().default(false),
  },
  (tabla) => [
    uniqueIndex("ocurrencias_clase_fecha").on(tabla.claseId, tabla.fecha),
    index("ocurrencias_centro_sede_empieza").on(tabla.centroId, tabla.sedeId, tabla.empiezaEn),
    foreignKey({
      name: "ocurrencias_clase",
      columns: [tabla.claseId, tabla.centroId, tabla.sedeId],
      foreignColumns: [clases.id, clases.centroId, clases.sedeId],
    }),
    check("ocurrencias_termina_despues", sql`${tabla.terminaEn} > ${tabla.empiezaEn}`),
  ],
);
