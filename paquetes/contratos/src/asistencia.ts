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
});

/** Respuesta de GET /asistencia/fechas/:id: la fecha y una página de sus inscriptos. */
export const planillaDeAsistencia = z.object({
  fecha: z.object({
    id: z.uuid(),
    claseId: z.uuid(),
    sedeId: z.uuid(),
    nombre: z.string(),
    /** La fecha local del centro. */
    fecha: z.iso.date(),
    /** En UTC: se pasa a la zona del centro solo al mostrarla. */
    empiezaEn: z.iso.datetime(),
    terminaEn: z.iso.datetime(),
    cancelada: z.boolean(),
  }),
  alumnos: paginaDe(renglon),
});

export type PedidoDeAsistencia = z.infer<typeof pedidoDeAsistencia>;
export type PlanillaDeAsistencia = z.infer<typeof planillaDeAsistencia>;
