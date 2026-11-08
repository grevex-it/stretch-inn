// El repositorio de los abonos: planes y precios, y cuotas.
import type { Transaccion } from "@app/plataforma";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { repositorioCuotas } from "./repositorio-cuotas.ts";
import { repositorioPlanes } from "./repositorio-planes.ts";

export function repositorioAbonos(tx: Transaccion): RepositorioAbonos {
  return { ...repositorioPlanes(tx), ...repositorioCuotas(tx) };
}
