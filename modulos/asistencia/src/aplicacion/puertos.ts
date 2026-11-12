// Lo que la asistencia necesita de afuera (ver docs/decisiones/0003): la base, agenda y personas.
import type { ContextoCentro, Resultado } from "@app/nucleo";
import type { ErrorDeAviso } from "../dominio/aviso.ts";
import type { ErrorDePlanilla, Estado, Marca } from "../dominio/planilla.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

/** La fecha de agenda, con lo que hace falta para la planilla. */
export interface Fecha {
  id: string;
  claseId: string;
  sedeId: string;
  nombre: string;
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
}

export interface Planilla {
  fecha: Fecha;
  alumnos: PaginaDe<Renglon>;
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
}

export type ErrorDeAsistencia =
  | ErrorDePlanilla
  | ErrorDeAviso
  | "fecha-inexistente"
  | "sin-permiso"
  | "no-inscripto"
  | "ya-avisado"
  | "aviso-inexistente";

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
  /** Avisa que el alumno no va a esa fecha, antes de que empiece. */
  avisar(
    quien: ContextoCentro,
    aviso: { fechaId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string }, ErrorDeAsistencia>>;
  /** Anula un aviso (al final viene), antes de que empiece la fecha. No lo borra. */
  anularAviso(
    quien: ContextoCentro,
    aviso: { id: string },
  ): Promise<Resultado<null, ErrorDeAsistencia>>;
}
