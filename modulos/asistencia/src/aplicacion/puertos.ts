// Lo que la asistencia necesita de afuera (ver docs/decisiones/0003): la base, agenda y personas.
import type { ContextoCentro, Resultado } from "@app/nucleo";
import type { ErrorDeAviso } from "../dominio/aviso.ts";
import type { ErrorDePlanilla, Estado, Marca } from "../dominio/planilla.ts";
import type { ErrorDeRecuperacion } from "../dominio/recuperacion.ts";
import type { ReglasDeRecuperacion } from "../dominio/reglas.ts";

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
  /**
   * Las primeras fechas del horario fijo del alumno en la sede desde ese día (agenda, hasta 100):
   * sin las canceladas ni las de clases en las que no estaba inscripto.
   */
  fechasDeAlumno(pedido: {
    alumnoId: string;
    sedeId: string;
    desde: string;
  }): Promise<{ id: string; fecha: string; empiezaEn: Date }[]>;
  /** Avisa todas esas fechas de la sede en una sola consulta; las ya avisadas no cuentan. */
  avisarVarias(
    fechas: readonly { id: string; sedeId: string }[],
    alumnoId: string,
    registro: Registro,
  ): Promise<number>;
  /** El aviso vigente, o undefined si no existe o ya se anuló. */
  aviso(id: string): Promise<{ ocurrenciaId: string } | undefined>;
  /** false si ya estaba anulado (otra anulación ganó la carrera). */
  anularAviso(id: string, ahora: Date): Promise<boolean>;
  /** Toma la fecha hasta el fin de la transacción: lo que mueve sus lugares va de a uno. */
  bloquearFecha(id: string): Promise<void>;
  /** Lo que mueve los lugares de la fecha: inscriptos (agenda), avisos y recuperaciones. */
  cuentaDeLugares(
    fecha: Pick<Fecha, "id" | "claseId" | "empiezaEn">,
  ): Promise<{ inscriptos: number; avisos: number; recuperaciones: number }>;
  /** El id de la recuperación nueva, o undefined si ya recupera en esa fecha. */
  recuperar(
    fecha: Pick<Fecha, "id" | "sedeId" | "empiezaEn">,
    reserva: { alumnoId: string },
    registro: Registro,
  ): Promise<string | undefined>;
  /** La recuperación vigente, o undefined si no existe o ya se anuló. */
  recuperacion(id: string): Promise<{ ocurrenciaId: string } | undefined>;
  /** false si ya estaba anulada. */
  anularRecuperacion(id: string, ahora: Date): Promise<boolean>;
  /** Los que recuperan en la fecha, por orden de reserva. */
  recuperan(
    filtro: Pagina & { ocurrenciaId: string },
  ): Promise<PaginaDe<{ alumnoId: string; recuperacionId: string }>>;
  /** Cuáles de esos alumnos recuperan en la fecha (hasta 100). */
  recuperanEntre(ocurrenciaId: string, alumnoIds: readonly string[]): Promise<Set<string>>;
  /** Las recuperaciones de un alumno van de a una hasta el fin de la transacción (el máximo). */
  bloquearAlumno(alumnoId: string): Promise<void>;
  /** Sus recuperaciones vigentes en la sede en fechas que empiezan en [desde, hasta). */
  recuperacionesEntre(filtro: {
    alumnoId: string;
    sedeId: string;
    desde: Date;
    hasta: Date;
  }): Promise<number>;
  /** Las reglas de recuperación de la sede, o undefined si no se configuraron. */
  reglas(sedeId: string): Promise<ReglasDeRecuperacion | undefined>;
  guardarReglas(sedeId: string, reglas: ReglasDeRecuperacion): Promise<void>;
}

/**
 * El abono vigente del alumno en ese momento (desde su inicio hasta el final de su última clase),
 * o undefined si no tiene. Lo responde `abonos`; la API lo conecta al armar los módulos
 * (asistencia no importa abonos).
 */
export type ConsultaAbonoVigente = (consulta: {
  alumnoId: string;
  sedeId: string;
  en: Date;
}) => Promise<{ inicio: Date; fin: Date } | undefined>;

export type ErrorDeAsistencia =
  | ErrorDePlanilla
  | ErrorDeAviso
  | "fecha-inexistente"
  | "sin-permiso"
  | "no-inscripto"
  | "ya-avisado"
  | "periodo-invalido"
  | "sin-fechas"
  | "aviso-inexistente"
  | ErrorDeRecuperacion
  | "ya-recupera"
  | "ya-inscripto"
  | "recuperacion-inexistente"
  | "fuera-de-tiempo"
  | "sin-abono"
  | "sin-recuperaciones"
  | "reglas-invalidas";

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
  /** Avisa que el alumno no va a esa fecha, antes de que empiece: libera su lugar. */
  avisar(
    quien: ContextoCentro,
    aviso: { fechaId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string }, ErrorDeAsistencia>>;
  /**
   * El viaje (0022): avisa cada fecha de su horario fijo en la sede entre dos días (inclusive)
   * que todavía no empezó. Devuelve cuántos avisos nuevos hizo.
   */
  avisarPeriodo(
    quien: ContextoCentro,
    periodo: { alumnoId: string; sedeId: string; desde: string; hasta: string },
  ): Promise<Resultado<{ avisos: number }, ErrorDeAsistencia>>;
  /** Anula un aviso (al final viene), antes de que empiece la fecha. No lo borra. */
  anularAviso(
    quien: ContextoCentro,
    aviso: { id: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
  /** Reserva un lugar en la fecha, dentro del abono y según las reglas de la sede (0020). */
  recuperar(
    quien: ContextoCentro,
    reserva: { fechaId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string }, ErrorDeAsistencia>>;
  /** Anula la reserva antes de que empiece la fecha: libera el lugar. */
  anularRecuperacion(
    quien: ContextoCentro,
    reserva: { id: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
  /** Las reglas de recuperación de la sede; sin configurar, las de por defecto. */
  reglas(
    quien: ContextoCentro,
    filtro: { sedeId: string },
  ): Promise<Resultado<ReglasDeRecuperacion, ErrorDeAsistencia>>;
  /** Cambia las reglas de recuperación de la sede (asistencia.configurar). */
  fijarReglas(
    quien: ContextoCentro,
    cambio: ReglasDeRecuperacion & { sedeId: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
}
