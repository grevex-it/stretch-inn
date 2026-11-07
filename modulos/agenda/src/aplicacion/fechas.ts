// Casos de uso de las fechas concretas: la semana de una sede y cancelar una fecha.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { ocurrenciasDeLaSemana } from "../dominio/ocurrencias.ts";
import { GESTIONAR, VER } from "../dominio/permisos.ts";
import { puedeEn, SIN_PERMISO } from "./clases.ts";
import type {
  ErrorDeAgenda,
  FechaDeClase,
  Pagina,
  PaginaDe,
  RepositorioAgenda,
} from "./puertos.ts";

const DIA = 24 * 60 * 60 * 1000;
const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);

/**
 * Las fechas de los 7 días que empiezan en `desde`. Arma a pedido las que falten (sin efecto
 * doble) de las clases activas, sin fechas anteriores al alta de cada clase.
 */
export async function semana(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId, desde, ...pagina }: Pagina & { sedeId: string; desde: string },
): Promise<Resultado<PaginaDe<FechaDeClase>, ErrorDeAgenda>> {
  if (!puedeEn(quien, VER, sedeId)) return SIN_PERMISO;
  const zona = await repo.zonaHoraria();
  const clases = await repo.clasesActivasDeSede(sedeId);
  const nuevas = clases.flatMap((clase) =>
    ocurrenciasDeLaSemana(clase, desde, zona)
      .filter((ocurrencia) => ocurrencia.terminaEn > clase.creadaEn)
      .map((ocurrencia) => ({ ...ocurrencia, claseId: clase.id, sedeId })),
  );
  await repo.guardarFechas(nuevas);
  return ok(await repo.fechas({ ...pagina, sedeId, desde, hasta: sumarDias(desde, 6) }));
}

/** Cancelar (o deshacerlo) solo antes de que empiece. */
export async function fijarCancelada(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { id, cancelada }: { id: string; cancelada: boolean },
): Promise<Resultado<null, ErrorDeAgenda>> {
  const fecha = await repo.fecha(id);
  if (fecha === undefined) return falla("fecha-inexistente", "Esa fecha no existe.");
  if (!puedeEn(quien, GESTIONAR, fecha.sedeId)) return SIN_PERMISO;
  if (fecha.empiezaEn <= ahora) {
    return falla("fecha-pasada", "Esa clase ya empezó: no se puede cambiar.");
  }
  await repo.fijarCancelada(id, cancelada);
  return ok(null);
}
