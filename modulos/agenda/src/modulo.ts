// Arma la agenda con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en
// su transacción con el contexto de quien la pide.
import { enContexto, type Base, type Transaccion } from "@app/plataforma";
import * as camas from "./aplicacion/camas.ts";
import * as clases from "./aplicacion/clases.ts";
import * as fechas from "./aplicacion/fechas.ts";
import * as inscripciones from "./aplicacion/inscripciones.ts";
import type { Agenda, OcupadasDeMas } from "./aplicacion/puertos.ts";
import { repositorioInscripciones } from "./infraestructura/repositorio-inscripciones.ts";
import { repositorioAgenda as repositorioDeAgenda } from "./infraestructura/repositorio.ts";

export interface OpcionesAgenda {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
  /** Los lugares que ocupan de más las recuperaciones en cada fecha: la API le pasa el de asistencia. */
  ocupadasDeMas?: OcupadasDeMas;
}

export function crearAgenda(base: Base, opciones: OpcionesAgenda = {}): Agenda {
  const ahora = opciones.ahora ?? (() => new Date());
  const repositorioAgenda = (tx: Transaccion) => repositorioDeAgenda(tx, opciones.ocupadasDeMas);
  const repos = (tx: Transaccion): inscripciones.Repositorios => ({
    agenda: repositorioAgenda(tx),
    inscripciones: repositorioInscripciones(tx),
  });
  return {
    clases: (quien, filtro) =>
      enContexto(base, quien, (tx) => clases.listar(repositorioAgenda(tx), quien, filtro)),
    crearClase: (quien, clase) =>
      enContexto(base, quien, (tx) => clases.crear(repositorioAgenda(tx), quien, clase)),
    editarClase: (quien, clase) =>
      enContexto(base, quien, (tx) => clases.editar(repositorioAgenda(tx), quien, ahora(), clase)),
    fijarActiva: (quien, cambio) =>
      enContexto(base, quien, (tx) =>
        clases.fijarActiva(repositorioAgenda(tx), quien, ahora(), cambio),
      ),
    semana: (quien, filtro) =>
      enContexto(base, quien, (tx) => fechas.semana(repositorioAgenda(tx), quien, filtro)),
    fijarCancelada: (quien, cambio) =>
      enContexto(base, quien, (tx) =>
        fechas.fijarCancelada(repositorioAgenda(tx), quien, ahora(), cambio),
      ),
    camas: (quien, pedido) =>
      enContexto(base, quien, (tx) => camas.camas(repositorioAgenda(tx), quien, pedido)),
    fijarCamas: (quien, cambio) =>
      enContexto(base, quien, (tx) => camas.fijar(repositorioAgenda(tx), quien, ahora(), cambio)),
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
