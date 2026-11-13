// Las clases dictadas por cada profe en un período (0022): a los profes se les paga por clase.
// Pide gestionar la agenda en la sede: muestra cuánto trabajó cada uno.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { ocurrenciasDelPeriodo } from "../dominio/ocurrencias.ts";
import { GESTIONAR } from "../dominio/permisos.ts";
import { puedeEn, SIN_PERMISO } from "./clases.ts";
import type { ClasesDictadas, ErrorDeAgenda, RepositorioAgenda } from "./puertos.ts";

const DIAS_MAXIMOS = 62;
const DIA = 86_400_000;

function periodoValido(desde: string, hasta: string): boolean {
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  if (!dia.test(desde) || !dia.test(hasta) || desde > hasta) return false;
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA < DIAS_MAXIMOS;
}

/**
 * Arma las fechas del período que falten (en memoria y en una sola escritura) y cuenta por profe
 * las que ya terminaron y no se cancelaron: el reemplazo de la fecha, o el profe de la clase.
 */
export async function clasesDictadas(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { sedeId, desde, hasta }: { sedeId: string; desde: string; hasta: string },
): Promise<Resultado<ClasesDictadas, ErrorDeAgenda>> {
  if (!puedeEn(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  if (!periodoValido(desde, hasta)) {
    return falla("periodo-invalido", "El período va de un día a otro, hasta 62 días.");
  }
  const zona = await repo.zonaHoraria();
  const clases = await repo.clasesActivasDeSede(sedeId);
  await repo.guardarFechas(
    clases.flatMap((clase) =>
      ocurrenciasDelPeriodo(clase, desde, hasta, zona)
        .filter((fecha) => fecha.terminaEn > clase.creadaEn)
        .map((fecha) => ({ ...fecha, claseId: clase.id, sedeId })),
    ),
  );
  const conteo = await repo.dictadas({ sedeId, desde, hasta, ahora });
  const conProfe = conteo.filter(
    (c): c is { profeId: string; clases: number } => c.profeId !== null,
  );
  const nombres = await repo.nombresDeProfes(conProfe.map((c) => c.profeId));
  const profes = conProfe.map(({ profeId, clases: dadas }) => ({
    profeId,
    nombre: nombres.get(profeId) ?? "",
    clases: dadas,
  }));
  profes.sort((a, b) => b.clases - a.clases || a.nombre.localeCompare(b.nombre, "es"));
  return ok({
    profes,
    sinProfe: conteo.find((c) => c.profeId === null)?.clases ?? 0,
  });
}
