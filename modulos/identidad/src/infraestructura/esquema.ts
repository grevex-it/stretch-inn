// Tablas de identidad (ver docs/decisiones/0007 y 0017). Las políticas de RLS y las funciones
// de alcance mínimo van en migraciones SQL (ver db/AGENTS.md).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Datos de la plataforma, previos a elegir centro: fuera del aislamiento por centro (0017). */
export const plataforma = pgSchema("plataforma");

/** La persona. Es de la plataforma: entra a los centros donde tiene usuario (0017). */
export const cuentas = plataforma.table(
  "cuentas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    hashClave: text("hash_clave").notNull(),
    debeCambiarClave: boolean("debe_cambiar_clave").notNull().default(true),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [uniqueIndex("cuentas_email").on(sql`lower(${tabla.email})`)],
);

/**
 * Sesión del panel (0017). Se guarda solo el hash del token. El centro y el usuario quedan en
 * null hasta que elige centro; sedeActivaId en null es «Todas mis sedes».
 */
export const sesiones = plataforma.table(
  "sesiones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hashToken: text("hash_token").notNull(),
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => cuentas.id),
    centroId: uuid("centro_id"),
    usuarioId: uuid("usuario_id"),
    sedeActivaId: uuid("sede_activa_id"),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull(),
    ultimoUsoEn: timestamp("ultimo_uso_en", { withTimezone: true }).notNull(),
    revocadaEn: timestamp("revocada_en", { withTimezone: true }),
  },
  (tabla) => [
    uniqueIndex("sesiones_hash_token").on(tabla.hashToken),
    index("sesiones_cuenta").on(tabla.cuentaId),
  ],
);

/** La membresía de una cuenta en un centro. */
export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => cuentas.id),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    /** Última sede que eligió en este centro; null es «Todas mis sedes» o todavía ninguna (0017). */
    ultimaSedeId: uuid("ultima_sede_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [uniqueIndex("usuarios_centro_cuenta").on(tabla.centroId, tabla.cuentaId)],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centroId: uuid("centro_id").notNull(),
    nombre: text("nombre").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (tabla) => [uniqueIndex("roles_centro_nombre").on(tabla.centroId, tabla.nombre)],
);

export const permisosDeRol = pgTable(
  "permisos_de_rol",
  {
    centroId: uuid("centro_id").notNull(),
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permiso: text("permiso").notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.centroId, tabla.rolId, tabla.permiso] })],
);

/** Un rol del usuario en una sede: puede ser encargado en una y recepción en otra (0007). */
export const asignaciones = pgTable(
  "asignaciones",
  {
    centroId: uuid("centro_id").notNull(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    sedeId: uuid("sede_id").notNull(),
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.centroId, tabla.usuarioId, tabla.sedeId, tabla.rolId] }),
  ],
);

/** Permiso extra o quitado a un usuario en una sede (0017: los ajustes son por sede). */
export const ajustes = pgTable(
  "ajustes",
  {
    centroId: uuid("centro_id").notNull(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    sedeId: uuid("sede_id").notNull(),
    permiso: text("permiso").notNull(),
    tipo: text("tipo").notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.centroId, tabla.usuarioId, tabla.sedeId, tabla.permiso] }),
    check("ajustes_tipo", sql`${tabla.tipo} in ('extra', 'quitado')`),
  ],
);
