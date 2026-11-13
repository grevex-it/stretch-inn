// Arma la agenda con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en
// su transacción con el contexto de quien la pide.
import { enContexto, type Base, type Transaccion } from "@app/plataforma";
import * as camas from "./aplicacion/camas.ts";
import * as clases from "./aplicacion/clases.ts";
import * as dictadas from "./aplicacion/dictadas.ts";
import * as fechas from "./aplicacion/fechas.ts";
import * as inscripciones from "./aplicacion/inscripciones.ts";
import * as profes from "./aplicacion/profes.ts";
import type { Agenda, OcupadasDeMas } from "./aplicacion/puertos.ts";
import { repositorioInscripciones } from "./infraestructura/repositorio-inscripciones.ts";
import { repositorioAgenda as repositorioDeAgenda } from "./infraestructura/repositorio.ts";

export interface OpcionesAgenda {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
  /** Los lugares que ocupan de más las recuperaciones en cada fecha: la API le pasa el de asistencia. */
  ocupadasDeMas?: OcupadasDeMas;
}

type ConRepo = <T>(
  quien: Parameters<typeof enContexto>[1],
  uso: (repo: ReturnType<typeof repositorioDeAgenda>) => Promise<T>,
) => Promise<T>;

/** La configuración de cada sede (profe fijo y camas), los reemplazos y las clases dictadas. */
function deLasSedes(con: ConRepo, ahora: () => Date) {
  return {
    clasesDictadas: (quien, filtro) =>
      con(quien, (repo) => dictadas.clasesDictadas(repo, quien, ahora(), filtro)),
    profeDeSede: (quien, pedido) => con(quien, (repo) => profes.deSede(repo, quien, pedido)),
    fijarProfeDeSede: (quien, cambio) =>
      con(quien, (repo) => profes.fijarDeSede(repo, quien, cambio)),
    fijarProfeDeFecha: (quien, cambio) =>
      con(quien, (repo) => profes.fijarDeFecha(repo, quien, cambio)),
    camas: (quien, pedido) => con(quien, (repo) => camas.camas(repo, quien, pedido)),
    fijarCamas: (quien, cambio) => con(quien, (repo) => camas.fijar(repo, quien, ahora(), cambio)),
  } satisfies Partial<Agenda>;
}

export function crearAgenda(base: Base, opciones: OpcionesAgenda = {}): Agenda {
  const ahora = opciones.ahora ?? (() => new Date());
  const repositorioAgenda = (tx: Transaccion) => repositorioDeAgenda(tx, opciones.ocupadasDeMas);
  const con: ConRepo = (quien, uso) => enContexto(base, quien, (tx) => uso(repositorioAgenda(tx)));
  const repos = (tx: Transaccion): inscripciones.Repositorios => ({
    agenda: repositorioAgenda(tx),
    inscripciones: repositorioInscripciones(tx),
  });
  return {
    ...deLasSedes(con, ahora),
    clases: (quien, filtro) => con(quien, (repo) => clases.listar(repo, quien, filtro)),
    crearClase: (quien, clase) => con(quien, (repo) => clases.crear(repo, quien, clase)),
    editarClase: (quien, clase) => con(quien, (repo) => clases.editar(repo, quien, ahora(), clase)),
    fijarActiva: (quien, cambio) =>
      con(quien, (repo) => clases.fijarActiva(repo, quien, ahora(), cambio)),
    semana: (quien, filtro) => con(quien, (repo) => fechas.semana(repo, quien, filtro)),
    fijarCancelada: (quien, cambio) =>
      con(quien, (repo) => fechas.fijarCancelada(repo, quien, ahora(), cambio)),
    inscribir: (quien, inscripcion) =>
      enContexto(base, quien, (tx) =>
        inscripciones.inscribir(repos(tx), quien, ahora(), inscripcion),
      ),
    darDeBajaInscripcion: (quien, inscripcion) =>
      enContexto(base, quien, (tx) =>
        inscripciones.darDeBaja(repos(tx), quien, ahora(), inscripcion),
      ),
    inscriptos: (quien, filtro) =>
      enContexto(base, quien, (tx) => inscripciones.deClase(repos(tx), quien, filtro)),
    clasesDeAlumno: (quien, filtro) =>
      enContexto(base, quien, (tx) => inscripciones.deAlumno(repos(tx), quien, filtro)),
  };
}
