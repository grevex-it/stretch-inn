// Alumnos del centro (ver docs/decisiones/0011): lista con buscador, ficha, alta, edición y baja.
// La forma de los datos; las reglas (documento sin repetir, teléfono con 6 números, fecha no
// futura) las aplica el módulo personas.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

/** Query de la lista: `?pagina=N&buscar=texto&bajas=si`. */
export const pedidoDeAlumnos = z
  .object({
    pagina: numeroDePagina,
    buscar: z.string().trim().max(100, "La búsqueda es muy larga.").optional(),
    bajas: z.literal("si").optional(),
  })
  .transform(({ pagina, buscar, bajas }) => ({
    pagina,
    porPagina: POR_PAGINA,
    ...(buscar === undefined || buscar === "" ? {} : { buscar }),
    ...(bajas === undefined ? {} : { conBajas: true }),
  }));

const obligatorio = (mensaje: string) =>
  z.string().trim().min(1, mensaje).max(100, "Es muy largo.");
/** Lo opcional llega vacío o en null; el módulo lo guarda como null. */
const opcional = <T extends z.ZodType<string>>(esquema: T) =>
  z.union([z.literal(""), esquema]).nullable();

export const fichaDeAlumno = z.object({
  nombre: obligatorio("Escribí el nombre."),
  apellido: obligatorio("Escribí el apellido."),
  /** El celular. Sin él, el alumno queda pendiente de completar (0022). */
  telefono: opcional(z.string().trim().max(40, "Revisá el teléfono.")),
  documento: opcional(z.string().trim().max(20, "Revisá el documento.")),
  email: opcional(z.email("Revisá el email.")),
  fechaNacimiento: opcional(z.iso.date("Revisá la fecha de nacimiento.")),
  notas: z.string().max(2000, "Las notas son muy largas."),
  /** Sin él, el alta toma el siguiente del centro y la edición conserva el que tenía. */
  numeroDeSocio: z
    .number("Revisá el número de socio.")
    .int("Revisá el número de socio.")
    .min(1, "El número de socio va de 1 a 999999.")
    .max(999_999, "El número de socio va de 1 a 999999.")
    .nullable()
    .optional(),
  /** La «primera clase» (0019). Sin ella, la edición conserva la que tenía. */
  fechaDeInicio: opcional(z.iso.date("Revisá la fecha de inicio.")).optional(),
  /** Su profe asignado, un usuario del equipo (0022). Sin él, la edición lo conserva. */
  profeId: z.uuid("Ese profe no existe.").nullable().optional(),
});

/** La edición lleva la versión que vio quien edita (0013). */
export const edicionDeAlumno = fichaDeAlumno.extend({ version: z.number().int() });

export const alumno = z.object({
  id: z.uuid(),
  nombre: z.string(),
  apellido: z.string(),
  telefono: z.string().nullable(),
  documento: z.string().nullable(),
  email: z.string().nullable(),
  fechaNacimiento: z.string().nullable(),
  notas: z.string(),
  numeroDeSocio: z.number().int(),
  fechaDeInicio: z.string().nullable(),
  profeId: z.uuid().nullable(),
  activo: z.boolean(),
  /** En UTC: cuándo se dio de baja; null si está activo. */
  bajaEn: z.iso.datetime().nullable(),
  /** Le falta el celular: no recibe mensajes automáticos hasta que lo tenga (0022). */
  pendienteDeCompletar: z.boolean(),
  version: z.number().int(),
});

export const paginaDeAlumnos = paginaDe(alumno);

/** Respuesta de POST /alumnos. */
export const alumnoCreado = z.object({ id: z.uuid() });

/** Respuesta de PUT /alumnos/:id: la versión nueva. */
export const alumnoEditado = z.object({ version: z.number().int() });

/**
 * Cuerpo de PUT y respuesta de GET /alumnos/:id/salud: las patologías, aparte de la ficha y con
 * permisos propios (0019). La versión es la que vio quien edita (0013): la primera vez, 0.
 */
export const saludDeAlumno = z.object({
  patologias: z.string().max(4000, "Las patologías son muy largas: hasta 4000 caracteres."),
  version: z.number().int().min(0),
});

/** Respuesta de PUT /alumnos/:id/salud: la versión nueva. */
export const saludGuardada = z.object({ version: z.number().int() });

export type PedidoDeAlumnos = z.infer<typeof pedidoDeAlumnos>;
export type FichaDeAlumno = z.infer<typeof fichaDeAlumno>;
export type EdicionDeAlumno = z.infer<typeof edicionDeAlumno>;
export type PaginaDeAlumnos = z.infer<typeof paginaDeAlumnos>;
export type Alumno = z.infer<typeof alumno>;
export type SaludDeAlumno = z.infer<typeof saludDeAlumno>;
