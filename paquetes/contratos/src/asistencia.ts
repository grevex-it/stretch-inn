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
export const avisoHecho = z.object({
  id: z.uuid(),
  /** Si llegó a tiempo y le dio un crédito para recuperar. */
  conCredito: z.boolean(),
});

/** Un crédito para recuperar: se usa en la sede de la fecha a la que se faltó. */
const credito = z.object({
  id: z.uuid(),
  sedeId: z.uuid(),
  /** La fecha a la que se faltó. */
  ocurrenciaId: z.uuid(),
  /** En UTC. */
  venceEn: z.iso.datetime(),
});

/** Respuesta de GET /alumnos/:id/creditos: los vigentes, el que vence antes primero. */
export const paginaDeCreditos = paginaDe(credito);

/** Cuerpo de POST /asistencia/fechas/:id/recuperaciones: usa el crédito que vence antes. */
export const pedidoDeRecuperacion = z.object({ alumnoId: z.uuid("Ese alumno no existe.") });

/** Respuesta de POST /asistencia/fechas/:id/recuperaciones: con este id se anula. */
export const recuperacionHecha = z.object({ id: z.uuid() });

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
