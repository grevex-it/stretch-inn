// Arma los abonos con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en
// su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import * as cuotasDeSede from "./aplicacion/cuotas-de-sede.ts";
import * as cuotas from "./aplicacion/cuotas.ts";
import * as planes from "./aplicacion/planes.ts";
import type { Abonos } from "./aplicacion/puertos.ts";
import { repositorioAbonos } from "./infraestructura/repositorio.ts";

export interface OpcionesAbonos {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearAbonos(base: Base, opciones: OpcionesAbonos = {}): Abonos {
  const ahora = opciones.ahora ?? (() => new Date());
  const con = <T>(
    quien: Parameters<typeof enContexto>[1],
    uso: (repo: ReturnType<typeof repositorioAbonos>) => Promise<T>,
  ) => enContexto(base, quien, (tx) => uso(repositorioAbonos(tx)));
  return {
    planes: (quien, filtro) => con(quien, (repo) => planes.listar(repo, quien, filtro)),
    crearPlan: (quien, plan) => con(quien, (repo) => planes.crear(repo, quien, plan)),
    editarPlan: (quien, plan) => con(quien, (repo) => planes.editar(repo, quien, plan)),
    fijarActivo: (quien, cambio) => con(quien, (repo) => planes.fijarActivo(repo, quien, cambio)),
    fijarPrecioDeSede: (quien, cambio) =>
      con(quien, (repo) => planes.fijarPrecioDeSede(repo, quien, cambio)),
    generarCuota: (quien, pedido) =>
      con(quien, (repo) => cuotas.generar(repo, quien, ahora(), pedido)),
    anularCuota: (quien, cuota) => con(quien, (repo) => cuotas.anular(repo, quien, ahora(), cuota)),
    cuotasDeAlumno: (quien, filtro) => con(quien, (repo) => cuotas.deAlumno(repo, quien, filtro)),
    cuotasImpagas: (quien, filtro) =>
      con(quien, (repo) => cuotasDeSede.impagas(repo, quien, filtro)),
    generarCuotasDelMes: (quien, pedido) =>
      con(quien, (repo) => cuotasDeSede.delMes(repo, quien, ahora(), pedido)),
  };
}
