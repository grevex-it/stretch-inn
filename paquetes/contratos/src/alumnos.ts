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
  telefono: z.string().trim().min(1, "Escribí el teléfono.").max(40, "Revisá el teléfono."),
  documento: opcional(z.string().trim().max(20, "Revisá el documento.")),
  email: opcional(z.email("Revisá el email.")),
  fechaNacimiento: opcional(z.iso.date("Revisá la fecha de nacimiento.")),
  notas: z.string().max(2000, "Las notas son muy largas."),
});

/** La edición lleva la versión que vio quien edita (0013). */
export const edicionDeAlumno = fichaDeAlumno.extend({ version: z.number().int() });

export const alumno = z.object({
  id: z.uuid(),
  nombre: z.string(),
  apellido: z.string(),
  telefono: z.string(),
  documento: z.string().nullable(),
  email: z.string().nullable(),
  fechaNacimiento: z.string().nullable(),
  notas: z.string(),
  activo: z.boolean(),
  version: z.number().int(),
});

export const paginaDeAlumnos = paginaDe(alumno);

/** Respuesta de POST /alumnos. */
export const alumnoCreado = z.object({ id: z.uuid() });

/** Respuesta de PUT /alumnos/:id: la versión nueva. */
export const alumnoEditado = z.object({ version: z.number().int() });

export type PedidoDeAlumnos = z.infer<typeof pedidoDeAlumnos>;
export type FichaDeAlumno = z.infer<typeof fichaDeAlumno>;
export type EdicionDeAlumno = z.infer<typeof edicionDeAlumno>;
export type PaginaDeAlumnos = z.infer<typeof paginaDeAlumnos>;
export type Alumno = z.infer<typeof alumno>;
