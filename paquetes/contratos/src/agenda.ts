// Agenda: clases semanales de cada sede y sus fechas concretas (ocurrencias). La forma de los
// datos; las reglas (horario, cupo, permiso por sede) las aplica el módulo agenda.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

const sede = z.uuid("Esa sede no existe.");

/** Query de la lista de clases: `?pagina=N&sede=uuid`. Sin sede, las de todas sus sedes. */
export const pedidoDeClases = z
  .object({ pagina: numeroDePagina, sede: sede.optional() })
  .transform(({ pagina, sede: sedeId }) => ({
    pagina,
    porPagina: POR_PAGINA,
    ...(sedeId === undefined ? {} : { sedeId }),
  }));

/** Query de la semana: `?sede=uuid&desde=AAAA-MM-DD&pagina=N`, los 7 días desde esa fecha. */
export const pedidoDeOcurrencias = z
  .object({
    pagina: numeroDePagina,
    sede,
    desde: z.iso.date("Revisá la fecha de inicio de la semana."),
  })
  .transform(({ pagina, sede: sedeId, desde }) => ({
    pagina,
    porPagina: POR_PAGINA,
    sedeId,
    desde,
  }));

const datosDeClase = z.object({
  nombre: z.string().max(100, "El nombre es muy largo."),
  /** 1 = lunes … 7 = domingo. */
  dia: z.number("Elegí el día de la semana.").int("Elegí el día de la semana."),
  /** Hora local del centro, HH:MM. */
  hora: z.string().max(5, "Revisá la hora: tiene que ser HH:MM."),
  duracionMinutos: z.number("Revisá la duración.").int("Revisá la duración."),
  cupo: z.number("Revisá el cupo.").int("Revisá el cupo."),
});

/** Un usuario del equipo (0022), o null: sin profe. */
const profe = z.uuid("Ese profe no existe.").nullable();

/** Sin `profeId`, la clase toma el profe fijo de la sede. */
export const fichaDeClase = datosDeClase.extend({ sedeId: sede, profeId: profe.optional() });

/**
 * La edición lleva la versión que vio quien edita (0013). La sede no se cambia; sin `profeId`, el
 * profe queda como estaba.
 */
export const edicionDeClase = datosDeClase.extend({
  version: z.number().int(),
  profeId: profe.optional(),
});

export const clase = datosDeClase.extend({
  id: z.uuid(),
  sedeId: z.uuid(),
  profeId: z.uuid().nullable(),
  activa: z.boolean(),
  /** Inscripciones vigentes: nunca más que el cupo. */
  inscriptos: z.number().int(),
  version: z.number().int(),
});

export const paginaDeClases = paginaDe(clase);

/** Respuesta de POST /agenda/clases. */
export const claseCreada = z.object({ id: z.uuid() });

/** Respuesta de PUT /agenda/clases/:id: la versión nueva. */
export const claseEditada = z.object({ version: z.number().int() });

export const ocurrencia = z.object({
  id: z.uuid(),
  claseId: z.uuid(),
  nombre: z.string(),
  cupo: z.number().int(),
  /** Los inscriptos fijos de la clase. */
  inscriptos: z.number().int(),
  /** La fecha local del centro. */
  fecha: z.iso.date(),
  /** En UTC: se pasa a la zona del centro solo al mostrarla. */
  empiezaEn: z.iso.datetime(),
  terminaEn: z.iso.datetime(),
  cancelada: z.boolean(),
  /** Quién la da: el reemplazo de la fecha, o el profe de la clase. */
  profeId: z.uuid().nullable(),
});

export const paginaDeOcurrencias = paginaDe(ocurrencia);

/** Cuerpo de POST /agenda/clases/:id/inscriptos. */
export const pedidoDeInscripcion = z.object({ alumnoId: z.uuid("Ese alumno no existe.") });

/** Respuesta de POST /agenda/clases/:id/inscriptos: con este id se da de baja. */
export const inscripcionHecha = z.object({ id: z.uuid() });

/** Un inscripto de una clase: la inscripción (con su id se da de baja) y su alumno. */
export const inscripto = z.object({
  id: z.uuid(),
  alumnoId: z.uuid(),
  nombre: z.string(),
  apellido: z.string(),
  /** null si el alumno no tiene celular cargado (pendiente de completar, 0022). */
  telefono: z.string().nullable(),
  /** El alumno puede estar de baja en personas aunque siga inscripto. */
  activo: z.boolean(),
  creadaEn: z.iso.datetime(),
});

/** Respuesta de GET /agenda/clases/:id/inscriptos, por orden de inscripción. */
export const paginaDeInscriptos = paginaDe(inscripto);

/** Una inscripción vigente de un alumno, con su clase. */
export const claseDeAlumno = z.object({ id: z.uuid(), clase });

/** Respuesta de GET /alumnos/:id/clases. */
export const paginaDeClasesDeAlumno = paginaDe(claseDeAlumno);

/**
 * Cuerpo de PUT y respuesta de GET /agenda/sedes/:id/camas: las camas de la sede, el tope del cupo
 * de sus clases. null: sin tope.
 */
export const camasDeSede = z.object({
  camas: z
    .number("Escribí la cantidad de camas.")
    .int("Las camas son un número entero.")
    .min(1, "Las camas van de 1 a 500.")
    .max(500, "Las camas van de 1 a 500.")
    .nullable(),
});

/**
 * Cuerpo de PUT y respuesta de GET /agenda/sedes/:id/profe (el profe fijo de la sede), y cuerpo de
 * PUT /agenda/ocurrencias/:id/profe (el reemplazo de una fecha; null vuelve al de la clase).
 */
export const profeDeSede = z.object({ profeId: profe });

export type PedidoDeClases = z.infer<typeof pedidoDeClases>;
export type PedidoDeOcurrencias = z.infer<typeof pedidoDeOcurrencias>;
export type FichaDeClase = z.infer<typeof fichaDeClase>;
export type EdicionDeClase = z.infer<typeof edicionDeClase>;
export type Clase = z.infer<typeof clase>;
export type PaginaDeClases = z.infer<typeof paginaDeClases>;
export type Ocurrencia = z.infer<typeof ocurrencia>;
export type PaginaDeOcurrencias = z.infer<typeof paginaDeOcurrencias>;
export type PedidoDeInscripcion = z.infer<typeof pedidoDeInscripcion>;
export type ClaseDeAlumno = z.infer<typeof claseDeAlumno>;
export type Inscripto = z.infer<typeof inscripto>;
export type PaginaDeInscriptos = z.infer<typeof paginaDeInscriptos>;
export type PaginaDeClasesDeAlumno = z.infer<typeof paginaDeClasesDeAlumno>;
export type CamasDeSede = z.infer<typeof camasDeSede>;
