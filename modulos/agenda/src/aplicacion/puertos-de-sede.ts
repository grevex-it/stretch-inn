// Lo que el repositorio de la agenda hace por cada sede: sus profes (0022, 0024) y sus camas.
// Aparte de puertos.ts para que cada archivo haga una sola cosa; RepositorioAgenda los extiende.
import type { DictadasDelDia } from "./dictadas-tipos.ts";

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioDeProfes {
  /** Si es un usuario activo del centro (identidad). */
  profeValido(id: string): Promise<boolean>;
  /** El profe fijo de la sede, o undefined. */
  profeDeSede(sedeId: string): Promise<string | undefined>;
  guardarProfeDeSede(sedeId: string, profeId: string | null): Promise<void>;
  /** Con null, la fecha vuelve a ser del profe de la clase. */
  fijarProfeDeFecha(id: string, profeId: string | null): Promise<void>;
  /**
   * Cuántas fechas de la sede en el período (días, inclusive) ya terminaron y no se cancelaron,
   * por día y por quién las dio (el reemplazo o el profe de la clase; null si ninguno), en orden
   * de fecha.
   */
  dictadas(filtro: {
    sedeId: string;
    desde: string;
    hasta: string;
    ahora: Date;
  }): Promise<DictadasDelDia[]>;
  /** El nombre de cada profe (identidad, hasta 100). */
  nombresDeProfes(ids: readonly string[]): Promise<Map<string, string>>;
  /**
   * Las fechas que ya empezaron y no tenían profe propio quedan con ese (el que tenía la clase):
   * cambiar el profe de la clase no cambia quién dio las pasadas.
   */
  congelarProfe(claseId: string, profeId: string | null, ahora: Date): Promise<void>;
}

/** Corre dentro de enContexto: RLS limita al centro y a las sedes visibles. */
export interface RepositorioDeCamas {
  /** Las camas de la sede, o undefined si no tiene tope. */
  camas(sedeId: string): Promise<number | undefined>;
  /** Los cambios de camas de una sede van de a uno hasta el fin de la transacción. */
  bloquearCamas(sedeId: string): Promise<void>;
  /**
   * Para leer las camas sin que cambien hasta el fin de la transacción: espera a un cambio en
   * curso, pero no a otras lecturas. Va antes de tomar cualquier clase de la sede.
   */
  compartirCamas(sedeId: string): Promise<void>;
  /** Con null, la sede queda sin tope. */
  guardarCamas(sedeId: string, camas: number | null): Promise<void>;
  /** Las clases de la sede con más cupo que esas camas, tomadas con `for update`. */
  clasesPorEncimaDe(
    sedeId: string,
    camas: number,
  ): Promise<{ id: string; nombre: string; inscriptos: number }[]>;
  bajarCupos(ids: readonly string[], camas: number): Promise<void>;
  /** Las clases de la sede con menos cupo pasan a esas camas, en una sola escritura. */
  subirCupos(sedeId: string, camas: number): Promise<void>;
}
