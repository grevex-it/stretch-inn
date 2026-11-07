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

export const fichaDeClase = datosDeClase.extend({ sedeId: sede });

/** La edición lleva la versión que vio quien edita (0013). La sede no se cambia. */
export const edicionDeClase = datosDeClase.extend({ version: z.number().int() });

export const clase = datosDeClase.extend({
  id: z.uuid(),
  sedeId: z.uuid(),
  activa: z.boolean(),
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
  /** La fecha local del centro. */
  fecha: z.iso.date(),
  /** En UTC: se pasa a la zona del centro solo al mostrarla. */
  empiezaEn: z.iso.datetime(),
  terminaEn: z.iso.datetime(),
  cancelada: z.boolean(),
});

export const paginaDeOcurrencias = paginaDe(ocurrencia);

export type PedidoDeClases = z.infer<typeof pedidoDeClases>;
export type PedidoDeOcurrencias = z.infer<typeof pedidoDeOcurrencias>;
export type FichaDeClase = z.infer<typeof fichaDeClase>;
export type EdicionDeClase = z.infer<typeof edicionDeClase>;
export type Clase = z.infer<typeof clase>;
export type PaginaDeClases = z.infer<typeof paginaDeClases>;
export type Ocurrencia = z.infer<typeof ocurrencia>;
export type PaginaDeOcurrencias = z.infer<typeof paginaDeOcurrencias>;
