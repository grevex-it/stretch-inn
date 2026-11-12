// Arma la asistencia con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre
// en su transacción con el contexto de quien la pide.
import { enContexto, type Base, type Transaccion } from "@app/plataforma";
import * as avisos from "./aplicacion/avisos.ts";
import * as planillas from "./aplicacion/planilla.ts";
import type { Asistencia, ConsultaAbonoVigente } from "./aplicacion/puertos.ts";
import * as recuperaciones from "./aplicacion/recuperaciones.ts";
import * as reglas from "./aplicacion/reglas.ts";
import { repositorioAsistencia } from "./infraestructura/repositorio.ts";

export interface OpcionesAsistencia {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
  /**
   * El abono vigente del alumno, dentro de la transacción de la recuperación. Lo conecta la API
   * con `abonos`. Sin él, nadie tiene abono vigente (0020).
   */
  abonoVigente?: (
    tx: Transaccion,
    consulta: Parameters<ConsultaAbonoVigente>[0],
  ) => ReturnType<ConsultaAbonoVigente>;
}

const sinAbono = (): ReturnType<ConsultaAbonoVigente> => Promise.resolve(undefined);

export function crearAsistencia(base: Base, opciones: OpcionesAsistencia = {}): Asistencia {
  const ahora = opciones.ahora ?? (() => new Date());
  const abonoVigente = opciones.abonoVigente ?? sinAbono;
  return {
    planilla: (quien, filtro) =>
      enContexto(base, quien, (tx) => planillas.planilla(repositorioAsistencia(tx), quien, filtro)),
    tomar: (quien, pedido) =>
      enContexto(base, quien, (tx) =>
        planillas.tomar(repositorioAsistencia(tx), quien, ahora(), pedido),
      ),
    avisar: (quien, aviso) =>
      enContexto(base, quien, (tx) =>
        avisos.avisar(repositorioAsistencia(tx), quien, ahora(), aviso),
      ),
    recuperar: (quien, reserva) =>
      enContexto(base, quien, (tx) =>
        recuperaciones.recuperar(repositorioAsistencia(tx), quien, ahora(), reserva, (consulta) =>
          abonoVigente(tx, consulta),
        ),
      ),
    anularRecuperacion: (quien, reserva) =>
      enContexto(base, quien, (tx) =>
        recuperaciones.anular(repositorioAsistencia(tx), quien, ahora(), reserva),
      ),
    anularAviso: (quien, aviso) =>
      enContexto(base, quien, (tx) =>
        avisos.anular(repositorioAsistencia(tx), quien, ahora(), aviso),
      ),
    reglas: (quien, filtro) =>
      enContexto(base, quien, (tx) => reglas.reglas(repositorioAsistencia(tx), quien, filtro)),
    fijarReglas: (quien, cambio) =>
      enContexto(base, quien, (tx) => reglas.fijar(repositorioAsistencia(tx), quien, cambio)),
  };
}
