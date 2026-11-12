// Lo que la asistencia necesita de afuera (ver docs/decisiones/0003): la base, agenda y personas.
import type { ContextoCentro, Resultado } from "@app/nucleo";
import type { ErrorDeAviso } from "../dominio/aviso.ts";
import type { ErrorDePlanilla, Estado, Marca } from "../dominio/planilla.ts";
import type { ErrorDeRecuperacion } from "../dominio/recuperacion.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

/** La fecha de agenda, con lo que hace falta para la planilla. */
export interface Fecha {
  id: string;
  claseId: string;
  sedeId: string;
  nombre: string;
  /** Lugares por fecha de la clase. */
  cupo: number;
  fecha: string;
  empiezaEn: Date;
  terminaEn: Date;
  cancelada: boolean;
}

/** Un renglón de la planilla: el inscripto en la fecha y su marca, si ya se tomó. */
export interface Renglon {
  alumnoId: string;
  nombre: string;
  apellido: string;
  /** El alumno puede estar de baja en personas aunque haya estado inscripto. */
  activo: boolean;
  estado: Estado | null;
  /** El aviso de ausencia vigente (con este id se anula), o null si no avisó. */
  avisoId: string | null;
  recuperacionId?: string;
}

export interface Planilla {
  fecha: Fecha;
  /** Los inscriptos de la fecha (una página). */
  alumnos: PaginaDe<Renglon>;
  /** Los que recuperan en la fecha (la misma página). */
  recuperan: PaginaDe<Renglon>;
  /** Lugares libres para recuperar. */
  lugares: number;
}

/** Quien registra la marca: un usuario del centro o soporte (0008). */
export interface Registro {
  tipo: "usuario" | "soporte";
  id: string;
  en: Date;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioAsistencia {
  /** La fecha (por la API pública de agenda), o undefined. */
  fecha(id: string): Promise<Fecha | undefined>;
  /** Los inscriptos de la clase en ese momento, por orden de inscripción (agenda). */
  inscriptos(
    filtro: Pagina & { claseId: string; momento: Date },
  ): Promise<PaginaDe<{ alumnoId: string }>>;
  /** Cuáles de esos alumnos estaban inscriptos en ese momento (agenda, hasta 100). */
  estabanInscriptos(filtro: {
    claseId: string;
    momento: Date;
    alumnoIds: readonly string[];
  }): Promise<Set<string>>;
  /** Los alumnos de una página, en una consulta (por la API pública de personas). */
  alumnos(
    ids: readonly string[],
  ): Promise<Map<string, Pick<Renglon, "nombre" | "apellido" | "activo">>>;
  /** Las marcas ya tomadas de esos alumnos en la fecha. */
  marcas(ocurrenciaId: string, alumnoIds: readonly string[]): Promise<Map<string, Estado>>;
  /** Guarda o corrige las marcas: una por alumno y fecha (sin efecto doble). */
  guardar(
    fecha: Pick<Fecha, "id" | "sedeId">,
    marcas: readonly Marca[],
    registro: Registro,
  ): Promise<void>;
  /** Los avisos de ausencia vigentes de esos alumnos en la fecha: alumno → id del aviso. */
  avisos(ocurrenciaId: string, alumnoIds: readonly string[]): Promise<Map<string, string>>;
  /** El id del aviso nuevo, o undefined si ya tenía uno vigente en esa fecha. */
  avisar(
    fecha: Pick<Fecha, "id" | "sedeId">,
    alumnoId: string,
    registro: Registro,
  ): Promise<string | undefined>;
  /** El aviso vigente, o undefined si no existe o ya se anuló. */
  aviso(id: string): Promise<{ ocurrenciaId: string } | undefined>;
  /** false si ya estaba anulado (otra anulación ganó la carrera). */
  anularAviso(id: string, ahora: Date): Promise<boolean>;
  /** El crédito que genera un aviso (uno por aviso). */
  crearCredito(credito: Omit<Credito, "id"> & { avisoId: string; alumnoId: string }): Promise<void>;
  /** Anula el crédito vigente de ese aviso, si lo tiene. */
  anularCreditoDeAviso(avisoId: string, ahora: Date): Promise<void>;
  /** Los créditos vigentes del alumno en esas sedes, por vencimiento (el que vence antes, primero). */
  creditos(
    filtro: Pagina & { alumnoId: string; sedeIds: readonly string[]; ahora: Date },
  ): Promise<PaginaDe<Credito>>;
  /** Toma la fecha hasta el fin de la transacción: lo que mueve sus lugares va de a uno. */
  bloquearFecha(id: string): Promise<void>;
  /** Lo que mueve los lugares de la fecha: inscriptos (agenda), avisos y recuperaciones. */
  cuentaDeLugares(
    fecha: Pick<Fecha, "id" | "claseId" | "empiezaEn">,
  ): Promise<{ inscriptos: number; avisos: number; recuperaciones: number }>;
  /** El crédito sin usar de esa sede que vence antes, vigente al empezar la fecha. */
  creditoParaUsar(filtro: {
    alumnoId: string;
    sedeId: string;
    empiezaEn: Date;
    ahora: Date;
  }): Promise<{ id: string } | undefined>;
  /** El id de la recuperación nueva, o undefined si ya recupera en esa fecha. */
  recuperar(
    fecha: Pick<Fecha, "id" | "sedeId">,
    reserva: { alumnoId: string; creditoId: string },
    registro: Registro,
  ): Promise<string | undefined>;
  /** La recuperación vigente, o undefined si no existe o ya se anuló. */
  recuperacion(id: string): Promise<{ ocurrenciaId: string } | undefined>;
  /** false si ya estaba anulada. Anular libera el crédito. */
  anularRecuperacion(id: string, ahora: Date): Promise<boolean>;
  /** Los que recuperan en la fecha, por orden de reserva. */
  recuperan(
    filtro: Pagina & { ocurrenciaId: string },
  ): Promise<PaginaDe<{ alumnoId: string; recuperacionId: string }>>;
  /** Cuáles de esos alumnos recuperan en la fecha (hasta 100). */
  recuperanEntre(ocurrenciaId: string, alumnoIds: readonly string[]): Promise<Set<string>>;
  /** Si el crédito de ese aviso ya se usó en una recuperación vigente. */
  creditoUsado(avisoId: string): Promise<boolean>;
}

/**
 * Cuándo termina el abono vigente del alumno en ese instante, o undefined si no tiene. Lo
 * responde `abonos`; la API lo conecta al armar los módulos (asistencia no importa abonos).
 */
export type ConsultaFinDelAbono = (consulta: {
  alumnoId: string;
  sedeId: string;
  en: Date;
}) => Promise<Date | undefined>;

/** Un derecho a recuperar, generado por un aviso de ausencia. Vence con el abono (0019). */
export interface Credito {
  id: string;
  /** La sede de la fecha a la que se faltó: se recupera en esa sede. */
  sedeId: string;
  /** La fecha a la que se faltó. */
  ocurrenciaId: string;
  venceEn: Date;
}

export type ErrorDeAsistencia =
  | ErrorDePlanilla
  | ErrorDeAviso
  | "fecha-inexistente"
  | "sin-permiso"
  | "no-inscripto"
  | "ya-avisado"
  | "aviso-inexistente"
  | ErrorDeRecuperacion
  | "sin-creditos"
  | "ya-recupera"
  | "ya-inscripto"
  | "recuperacion-inexistente"
  | "credito-usado";

export interface Asistencia {
  /** La fecha y una página de sus inscriptos, con la marca de cada uno. */
  planilla(
    quien: ContextoCentro,
    filtro: Pagina & { fechaId: string },
  ): Promise<Resultado<Planilla, ErrorDeAsistencia>>;
  /** Guarda o corrige las marcas de la fecha, todas o ninguna. */
  tomar(
    quien: ContextoCentro,
    pedido: { fechaId: string; marcas: readonly Marca[] },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
  /** Avisa que el alumno no va a esa fecha, antes de que empiece. Siempre da crédito (0019). */
  avisar(
    quien: ContextoCentro,
    aviso: { fechaId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string; conCredito: boolean }, ErrorDeAsistencia>>;
  /** Los créditos vigentes del alumno, en las sedes donde se puede ver la asistencia. */
  creditos(
    quien: ContextoCentro,
    filtro: Pagina & { alumnoId: string },
  ): Promise<Resultado<PaginaDe<Credito>, ErrorDeAsistencia>>;
  /** Anula un aviso (al final viene), antes de que empiece la fecha. No lo borra. */
  anularAviso(
    quien: ContextoCentro,
    aviso: { id: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
  /** Reserva un lugar en la fecha con el crédito que vence antes. */
  recuperar(
    quien: ContextoCentro,
    reserva: { fechaId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string }, ErrorDeAsistencia>>;
  /** Anula la reserva antes de que empiece la fecha: el crédito vuelve a estar libre. */
  anularRecuperacion(
    quien: ContextoCentro,
    reserva: { id: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
}
