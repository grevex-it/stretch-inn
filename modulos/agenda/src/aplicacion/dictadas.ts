// Las clases dictadas por cada profe en un período (0022): a los profes se les paga por clase.
// Pide gestionar la agenda en la sede: muestra cuánto trabajó cada uno.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { ocurrenciasDelPeriodo } from "../dominio/ocurrencias.ts";
import { GESTIONAR } from "../dominio/permisos.ts";
import { puedeEn, SIN_PERMISO } from "./clases.ts";
import type { ClasesDictadas, DictadasDelDia } from "./dictadas-tipos.ts";
import type { ErrorDeAgenda, RepositorioAgenda } from "./puertos.ts";

const DIAS_MAXIMOS = 62;
const DIA = 86_400_000;

function periodoValido(desde: string, hasta: string): boolean {
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  if (!dia.test(desde) || !dia.test(hasta) || desde > hasta) return false;
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA < DIAS_MAXIMOS;
}

/** Arma las fechas del período que falten, en memoria y en una sola escritura. */
async function armarFechasDelPeriodo(
  repo: RepositorioAgenda,
  { sedeId, desde, hasta }: { sedeId: string; desde: string; hasta: string },
): Promise<void> {
  const zona = await repo.zonaHoraria();
  const clases = await repo.clasesActivasDeSede(sedeId);
  await repo.guardarFechas(
    clases.flatMap((clase) =>
      ocurrenciasDelPeriodo(clase, desde, hasta, zona)
        .filter((fecha) => fecha.terminaEn > clase.creadaEn)
        .map((fecha) => ({ ...fecha, claseId: clase.id, sedeId })),
    ),
  );
}

/**
 * Las clases dictadas de la sede por día y por profe (0024): las fechas del período que ya
 * terminaron y no se cancelaron. Sin control de permisos: la llama otro módulo, que controla los
 * suyos. Falla con un período de más de 62 días.
 */
export async function porDia(
  repo: RepositorioAgenda,
  filtro: { sedeId: string; desde: string; hasta: string; ahora: Date },
): Promise<DictadasDelDia[]> {
  if (!periodoValido(filtro.desde, filtro.hasta)) {
    throw new Error("El período de las clases dictadas va de un día a otro, hasta 62 días.");
  }
  await armarFechasDelPeriodo(repo, filtro);
  return repo.dictadas(filtro);
}

/** Suma los días por profe: el que más clases dio primero y, si empatan, por nombre. */
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
  const dias = await porDia(repo, { sedeId, desde, hasta, ahora });
  const porProfe = new Map<string | null, number>();
  for (const { profeId, clases } of dias)
    porProfe.set(profeId, (porProfe.get(profeId) ?? 0) + clases);
  const ids = [...porProfe.keys()].filter((id): id is string => id !== null);
  const nombres = await repo.nombresDeProfes(ids);
  const profes = ids.map((profeId) => ({
    profeId,
    nombre: nombres.get(profeId) ?? "",
    clases: porProfe.get(profeId) ?? 0,
  }));
  profes.sort((a, b) => b.clases - a.clases || a.nombre.localeCompare(b.nombre, "es"));
  return ok({ profes, sinProfe: porProfe.get(null) ?? 0 });
}
