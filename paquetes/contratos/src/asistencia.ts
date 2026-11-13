// Asistencia: la planilla de una fecha y las marcas que se guardan. Las reglas (cuándo se toma,
// quiénes figuran, permiso por sede) las aplica el módulo asistencia.
import { z } from "zod";
import { paginaDe } from "./paginas.ts";

const estado = z.enum(["presente", "ausente"], "Cada alumno va presente o ausente.");

/** Cuerpo de PUT /asistencia/fechas/:id: de 1 a 100 marcas, una por alumno. */
export const pedidoDeAsistencia = z.object({
  marcas: z
    .array(z.object({ alumnoId: z.uuid("Ese alumno no existe."), estado }))
    .min(1, "Marcá al menos un alumno.")
    .max(100, "Se pueden guardar hasta 100 alumnos por vez."),
});

const renglon = z.object({
  alumnoId: z.uuid(),
  nombre: z.string(),
  apellido: z.string(),
  /** El alumno puede estar de baja en personas aunque haya estado inscripto. */
  activo: z.boolean(),
  /** null mientras no se marcó. */
  estado: estado.nullable(),
  /** El aviso de ausencia vigente (con este id se anula), o null si no avisó. */
  avisoId: z.uuid().nullable(),
  recuperacionId: z.uuid().optional(),
});

/** Cuerpo de POST /asistencia/fechas/:id/avisos. */
export const pedidoDeAviso = z.object({ alumnoId: z.uuid("Ese alumno no existe.") });

/** Respuesta de POST /asistencia/fechas/:id/avisos: con este id se anula. */
export const avisoHecho = z.object({ id: z.uuid() });

/**
 * Cuerpo de POST /asistencia/alumnos/:id/ausencias: el viaje (0022). Avisa cada fecha de su horario
 * fijo en la sede entre los dos días, inclusive.
 */
export const pedidoDeAusencias = z.object({
  sedeId: z.uuid("Esa sede no existe."),
  desde: z.iso.date("Revisá el día de inicio."),
  hasta: z.iso.date("Revisá el día de fin."),
});

/** Respuesta: cuántos avisos nuevos hizo (las fechas ya avisadas no cuentan). */
export const ausenciasAvisadas = z.object({ avisos: z.number().int() });

/** Cuerpo de POST /asistencia/fechas/:id/recuperaciones (0020: no hace falta un aviso previo). */
export const pedidoDeRecuperacion = z.object({ alumnoId: z.uuid("Ese alumno no existe.") });

/** Respuesta de POST /asistencia/fechas/:id/recuperaciones: con este id se anula. */
export const recuperacionHecha = z.object({ id: z.uuid() });

/**
 * Las reglas de recuperación de una sede (0020): cuerpo de PUT y respuesta de GET
 * /asistencia/sedes/:id/reglas.
 */
export const reglasDeRecuperacion = z.object({
  /** Cuántos minutos antes de la clase hay que anotarse a recuperar. */
  anticipacionMinutos: z
    .number("La anticipación va en minutos enteros, de 0 a una semana.")
    .int("La anticipación va en minutos enteros, de 0 a una semana.")
    .min(0, "La anticipación va en minutos enteros, de 0 a una semana.")
    .max(10_080, "La anticipación va en minutos enteros, de 0 a una semana."),
  /** Cuántas recuperaciones se pueden hacer por abono. */
  maximoPorAbono: z
    .number("El máximo por abono va de 0 a 100 recuperaciones.")
    .int("El máximo por abono va de 0 a 100 recuperaciones.")
    .min(0, "El máximo por abono va de 0 a 100 recuperaciones.")
    .max(100, "El máximo por abono va de 0 a 100 recuperaciones."),
  /** Si se puede recuperar sin un abono vigente. */
  sinAbono: z.boolean(),
});

/**
 * Respuesta de GET /asistencia/fechas/:id: la fecha, la misma página de sus inscriptos y de los
 * que recuperan, y los lugares libres para recuperar.
 */
export const planillaDeAsistencia = z.object({
  fecha: z.object({
    id: z.uuid(),
    claseId: z.uuid(),
    sedeId: z.uuid(),
    nombre: z.string(),
    cupo: z.number().int(),
    /** La fecha local del centro. */
    fecha: z.iso.date(),
    /** En UTC: se pasa a la zona del centro solo al mostrarla. */
    empiezaEn: z.iso.datetime(),
    terminaEn: z.iso.datetime(),
    cancelada: z.boolean(),
  }),
  alumnos: paginaDe(renglon),
  recuperan: paginaDe(renglon),
  lugares: z.number().int(),
});

export type PedidoDeAsistencia = z.infer<typeof pedidoDeAsistencia>;
export type PlanillaDeAsistencia = z.infer<typeof planillaDeAsistencia>;
export type PedidoDeAviso = z.infer<typeof pedidoDeAviso>;
export type PedidoDeRecuperacion = z.infer<typeof pedidoDeRecuperacion>;
export type ReglasDeRecuperacion = z.infer<typeof reglasDeRecuperacion>;
