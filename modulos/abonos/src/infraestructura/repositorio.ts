// El repositorio de los abonos: planes y precios, cuotas, y cuotas de toda una sede.
import type { Transaccion } from "@app/plataforma";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { repositorioCuotas } from "./repositorio-cuotas.ts";
import { repositorioPlanes } from "./repositorio-planes.ts";
import { repositorioSede } from "./repositorio-sede.ts";

export function repositorioAbonos(tx: Transaccion): RepositorioAbonos {
  return { ...repositorioPlanes(tx), ...repositorioCuotas(tx), ...repositorioSede(tx) };
}
