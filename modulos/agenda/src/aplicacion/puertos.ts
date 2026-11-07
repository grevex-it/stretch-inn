// Lo que la agenda necesita de afuera (ver docs/decisiones/0003): la base y el reloj.
import type { ContextoCentro, Resultado } from "@app/nucleo";
import type { DatosDeClase, ErrorDeClase } from "../dominio/clase.ts";
import type { ErrorDeInscripcion } from "../dominio/inscripcion.ts";

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface PaginaDe<T> extends Pagina {
  elementos: T[];
  total: number;
}

export interface Clase extends DatosDeClase {
  id: string;
  sedeId: string;
  activa: boolean;
  /** Inscripciones vigentes: nunca más que el cupo. */
  inscriptos: number;
  version: number;
}

/** Una fecha concreta, con lo que hace falta para mostrarla en la grilla. */
export interface FechaDeClase {
  id: string;
  claseId: string;
  nombre: string;
  cupo: number;
  /** Los inscriptos fijos de la clase. */
  inscriptos: number;
  /** La fecha local del centro, AAAA-MM-DD. */
  fecha: string;
  empiezaEn: Date;
  terminaEn: Date;
  cancelada: boolean;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioAgenda {
  zonaHoraria(): Promise<string>;
  clases(filtro: Pagina & { sedeIds: readonly string[] }): Promise<PaginaDe<Clase>>;
  /** Con `bloquear`, la fila queda tomada hasta el fin de la transacción (`for update`). */
  clase(id: string, bloquear?: boolean): Promise<(Clase & { creadaEn: Date }) | undefined>;
  clasesActivasDeSede(sedeId: string): Promise<(Clase & { creadaEn: Date })[]>;
  crearClase(sedeId: string, datos: DatosDeClase): Promise<{ id: string }>;
  /** La versión nueva, o undefined si la clase cambió en el medio. */
  actualizarClase(id: string, version: number, datos: DatosDeClase): Promise<number | undefined>;
  fijarActiva(id: string, activa: boolean): Promise<void>;
  /** Las que falten; las que ya están no se tocan (sin efecto doble). */
  guardarFechas(
    fechas: readonly {
      claseId: string;
      sedeId: string;
      fecha: string;
      empiezaEn: Date;
      terminaEn: Date;
    }[],
  ): Promise<void>;
  fechas(
    filtro: Pagina & { sedeId: string; desde: string; hasta: string },
  ): Promise<PaginaDe<FechaDeClase>>;
  fechasFuturas(claseId: string, ahora: Date): Promise<{ id: string; fecha: string }[]>;
  moverFechas(cambios: readonly { id: string; empiezaEn: Date; terminaEn: Date }[]): Promise<void>;
  borrarFechas(ids: readonly string[]): Promise<void>;
  fecha(id: string): Promise<{ sedeId: string; empiezaEn: Date } | undefined>;
  fijarCancelada(id: string, cancelada: boolean): Promise<void>;
}

export type ErrorDeAgenda =
  | ErrorDeClase
  | ErrorDeInscripcion
  | "ya-inscripto"
  | "inscripcion-inexistente"
  | "sin-permiso"
  | "clase-inexistente"
  | "fecha-inexistente"
  | "fecha-pasada"
  | "cambio-concurrente";

export type NuevaClase = DatosDeClase & { sedeId: string };
export type EdicionDeClase = DatosDeClase & { id: string; version: number };

/** Lo que exporta el módulo: cada operación corre en su transacción con el contexto. */
export interface Agenda {
  clases(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId?: string },
  ): Promise<Resultado<PaginaDe<Clase>, ErrorDeAgenda>>;
  crearClase(
    quien: ContextoCentro,
    clase: NuevaClase,
  ): Promise<Resultado<{ id: string }, ErrorDeAgenda>>;
  editarClase(
    quien: ContextoCentro,
    clase: EdicionDeClase,
  ): Promise<Resultado<{ version: number }, ErrorDeAgenda>>;
  fijarActiva(
    quien: ContextoCentro,
    cambio: { id: string; activa: boolean },
  ): Promise<Resultado<null, ErrorDeAgenda>>;
  semana(
    quien: ContextoCentro,
    filtro: Pagina & { sedeId: string; desde: string },
  ): Promise<Resultado<PaginaDe<FechaDeClase>, ErrorDeAgenda>>;
  fijarCancelada(
    quien: ContextoCentro,
    cambio: { id: string; cancelada: boolean },
  ): Promise<Resultado<null, ErrorDeAgenda>>;
  inscribir(
    quien: ContextoCentro,
    inscripcion: { claseId: string; alumnoId: string },
  ): Promise<Resultado<{ id: string }, ErrorDeAgenda>>;
  darDeBajaInscripcion(
    quien: ContextoCentro,
    inscripcion: { id: string },
  ): Promise<Resultado<null, ErrorDeAgenda>>;
  /** Las inscripciones vigentes del alumno, en las sedes donde se puede ver la agenda. */
  clasesDeAlumno(
    quien: ContextoCentro,
    filtro: Pagina & { alumnoId: string },
  ): Promise<Resultado<PaginaDe<InscripcionDeAlumno>, ErrorDeAgenda>>;
}

export interface InscripcionDeAlumno {
  /** La inscripción: con este id se da de baja. */
  id: string;
  clase: Clase;
}

/** Corre dentro de enContexto, con la clase ya bloqueada cuando cambia el cupo. */
export interface RepositorioInscripciones {
  /** El alumno del centro (por la API pública de personas), o undefined. */
  alumno(id: string): Promise<{ activo: boolean } | undefined>;
  /** El id de la inscripción nueva, o undefined si ya tenía una vigente en esa clase. */
  inscribir(inscripcion: {
    claseId: string;
    sedeId: string;
    alumnoId: string;
  }): Promise<string | undefined>;
  sumarInscriptos(claseId: string, cuantos: 1 | -1): Promise<void>;
  vigente(id: string): Promise<{ claseId: string } | undefined>;
  /** false si ya estaba de baja (otra baja ganó la carrera). */
  darDeBaja(id: string, ahora: Date): Promise<boolean>;
  deAlumno(
    filtro: Pagina & { alumnoId: string; sedeIds: readonly string[] },
  ): Promise<PaginaDe<InscripcionDeAlumno>>;
}
