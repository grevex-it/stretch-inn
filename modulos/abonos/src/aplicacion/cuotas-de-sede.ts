// Casos de uso sobre las cuotas de toda una sede: las impagas y renovar los ciclos que terminaron.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { ciclosHasta, diaDe, esDia } from "../dominio/ciclo.ts";
import { ASIGNAR, VER } from "../dominio/permisos.ts";
import { precioEnSede } from "../dominio/plan.ts";
import { enSede, SIN_PERMISO } from "./planes.ts";
import type {
  CicloARenovar,
  ErrorDeAbonos,
  Pagina,
  PaginaDeImpagas,
  RepositorioAbonos,
  Renovacion,
} from "./puertos.ts";

/** De a cuántos alumnos se renueva: el tope de alumnos que personas devuelve juntos. */
const TANDA = 100;

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
    ({ id, alumnoId, planId, sedeId, desde, hasta, monto }) => {
      const alumno = alumnos.get(alumnoId) ?? null;
      return { id, alumnoId, planId, sedeId, desde, hasta, monto, alumno };
    },
  );
  return ok({ ...pagina, elementos });
}

/**
 * Renueva los ciclos de la sede que terminaron hasta `dia` (por defecto, hoy en el centro): el
 * ciclo siguiente empieza el día en que terminó el último, con el mismo plan y el precio de hoy
 * (0019). Quien quedó atrás recibe todos los ciclos que le faltan, así que repetirlo no duplica.
 * No se renuevan los de alumnos o planes de baja.
 */
export async function renovar(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  pedido: { sedeId: string; dia?: string },
): Promise<Resultado<Renovacion, ErrorDeAbonos>> {
  const { sedeId } = pedido;
  if (!enSede(quien, ASIGNAR, sedeId)) return SIN_PERMISO;
  const dia = pedido.dia ?? diaDe(ahora, await repo.zonaHoraria());
  if (!esDia(dia)) return falla("dia-invalido", "El día va como AAAA-MM-DD.");
  const hecho: Renovacion = { dia, generadas: 0, alumnosDeBaja: 0, planesDeBaja: 0 };
  let despuesDe: string | undefined;
  for (;;) {
    // De a tandas: tres consultas cada cien alumnos, no una por alumno (regla 8).
    const tanda = await repo.ciclosARenovar({ sedeId, dia, despuesDe, limite: TANDA });
    if (tanda.length === 0) break;
    await renovarTanda(repo, tanda, { sedeId, dia }, hecho);
    despuesDe = tanda.at(-1)?.alumnoId;
    if (tanda.length < TANDA) break;
  }
  return ok(hecho);
}

async function renovarTanda(
  repo: RepositorioAbonos,
  tanda: readonly CicloARenovar[],
  { sedeId, dia }: { sedeId: string; dia: string },
  hecho: Renovacion,
): Promise<void> {
  const alumnos = await repo.alumnos(tanda.map((c) => c.alumnoId));
  const nuevas = [];
  for (const ciclo of tanda) {
    if (alumnos.get(ciclo.alumnoId)?.activo !== true) hecho.alumnosDeBaja++;
    else if (!ciclo.planActivo) hecho.planesDeBaja++;
    else {
      const { alumnoId, planId } = ciclo;
      const monto = precioEnSede(ciclo.precio, ciclo.precioDeSede);
      for (const fechas of ciclosHasta(ciclo.hasta, dia)) {
        nuevas.push({ alumnoId, planId, sedeId, monto, ...fechas });
      }
    }
  }
  if (nuevas.length > 0) hecho.generadas += await repo.generarCuotas(nuevas);
}
