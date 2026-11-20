// Lo que agenda le da a profesores (0024): las clases dictadas de una sede por día y por profe,
// para pagar cada una con la tarifa vigente ese día. Con la Transaccion de enContexto: RLS limita
// al centro y a las sedes visibles. Arma las fechas del período que falten (escribe en las tablas
// de agenda, desde agenda).
import type { Transaccion } from "@app/plataforma";
import { porDia } from "../aplicacion/dictadas.ts";
import type { DictadasDelDia } from "../aplicacion/dictadas-tipos.ts";
import { repositorioAgenda } from "./repositorio.ts";

export function dictadasPorDia(
  tx: Transaccion,
  filtro: { sedeId: string; desde: string; hasta: string; ahora: Date },
): Promise<DictadasDelDia[]> {
  return porDia(repositorioAgenda(tx), filtro);
}
