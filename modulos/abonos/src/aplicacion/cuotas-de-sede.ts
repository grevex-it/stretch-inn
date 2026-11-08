// Casos de uso sobre las cuotas de toda una sede: las impagas y generar las del mes.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { esPeriodo, periodoAnterior, periodoDe } from "../dominio/periodo.ts";
import { ASIGNAR, VER } from "../dominio/permisos.ts";
import { precioEnSede } from "../dominio/plan.ts";
import { enSede, SIN_PERMISO } from "./planes.ts";
import type {
  CuotaARenovar,
  CuotasDelMes,
  ErrorDeAbonos,
  Pagina,
  PaginaDeImpagas,
  RepositorioAbonos,
} from "./puertos.ts";

/** De a cuántas cuotas se renuevan: el tope de alumnos que personas devuelve juntos. */
const TANDA = 100;
const PERIODO_INVALIDO = falla("periodo-invalido", "El mes va como AAAA-MM.");

/** Las impagas de la sede, con el alumno de cada una (una sola consulta a personas). */
export async function impagas(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  filtro: Pagina & { sedeId: string; periodo?: string },
): Promise<Resultado<PaginaDeImpagas, ErrorDeAbonos>> {
  if (!enSede(quien, VER, filtro.sedeId)) return SIN_PERMISO;
  if (filtro.periodo !== undefined && !esPeriodo(filtro.periodo)) return PERIODO_INVALIDO;
  const pagina = await repo.cuotasImpagas(filtro);
  const alumnos = await repo.alumnos([...new Set(pagina.elementos.map((c) => c.alumnoId))]);
  const elementos = pagina.elementos.map(({ id, alumnoId, planId, sedeId, periodo, monto }) => {
    const alumno = alumnos.get(alumnoId) ?? null;
    return { id, alumnoId, planId, sedeId, periodo, monto, alumno };
  });
  return ok({ ...pagina, elementos });
}

/**
 * [SUPUESTO] Las cuotas del mes de una sede son la renovación de las vigentes del mes anterior:
 * mismo alumno y plan, con el precio de hoy. No se renuevan las de alumnos o planes de baja, y un
 * alumno que ya tiene la cuota del mes no se toca, así que repetirlo no duplica.
 */
export async function delMes(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  ahora: Date,
  pedido: { sedeId: string; periodo?: string },
): Promise<Resultado<CuotasDelMes, ErrorDeAbonos>> {
  const { sedeId } = pedido;
  if (!enSede(quien, ASIGNAR, sedeId)) return SIN_PERMISO;
  const periodo = pedido.periodo ?? periodoDe(ahora, await repo.zonaHoraria());
  if (!esPeriodo(periodo)) return PERIODO_INVALIDO;
  const hecho = { periodo, generadas: 0, yaTenian: 0, alumnosDeBaja: 0, planesDeBaja: 0 };
  const anterior = { sedeId, periodo: periodoAnterior(periodo), limite: TANDA };
  let despuesDe: string | undefined;
  for (;;) {
    // De a tandas: tres consultas cada cien alumnos, no una por alumno (regla 8).
    const tanda = await repo.cuotasARenovar({ ...anterior, despuesDe });
    if (tanda.length === 0) break;
    await renovar(repo, tanda, { sedeId, periodo }, hecho);
    despuesDe = tanda.at(-1)?.alumnoId;
    if (tanda.length < TANDA) break;
  }
  return ok(hecho);
}

async function renovar(
  repo: RepositorioAbonos,
  tanda: readonly CuotaARenovar[],
  destino: { sedeId: string; periodo: string },
  hecho: CuotasDelMes,
): Promise<void> {
  const alumnos = await repo.alumnos(tanda.map((c) => c.alumnoId));
  const nuevas = [];
  for (const cuota of tanda) {
    if (alumnos.get(cuota.alumnoId)?.activo !== true) hecho.alumnosDeBaja++;
    else if (!cuota.planActivo) hecho.planesDeBaja++;
    else {
      const monto = precioEnSede(cuota.precio, cuota.precioDeSede);
      nuevas.push({ ...destino, alumnoId: cuota.alumnoId, planId: cuota.planId, monto });
    }
  }
  const generadas = nuevas.length === 0 ? 0 : await repo.generarCuotas(nuevas);
  hecho.generadas += generadas;
  hecho.yaTenian += nuevas.length - generadas;
}
