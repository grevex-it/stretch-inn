// Casos de uso sobre las cuotas de toda una sede: las impagas.
import { ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { VER } from "../dominio/permisos.ts";
import { enSede, SIN_PERMISO } from "./planes.ts";
import type { ErrorDeAbonos, Pagina, PaginaDeImpagas, RepositorioAbonos } from "./puertos.ts";

/** Las impagas de la sede, con el alumno de cada una (una sola consulta a personas). */
export async function impagas(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  filtro: Pagina & { sedeId: string },
): Promise<Resultado<PaginaDeImpagas, ErrorDeAbonos>> {
  if (!enSede(quien, VER, filtro.sedeId)) return SIN_PERMISO;
  const pagina = await repo.cuotasImpagas(filtro);
  const alumnos = await repo.alumnos([...new Set(pagina.elementos.map((c) => c.alumnoId))]);
  const elementos = pagina.elementos.map(
    ({ id, alumnoId, planId, sedeId, desde, clases, monto }) => {
      const alumno = alumnos.get(alumnoId) ?? null;
      return { id, alumnoId, planId, sedeId, desde, clases, monto, alumno };
    },
  );
  return ok({ ...pagina, elementos });
}
