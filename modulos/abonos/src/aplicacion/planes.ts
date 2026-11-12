// Casos de uso de los planes y sus precios por sede. El plan es del centro: verlo y gestionarlo
// pide el permiso en alguna sede; el precio propio de una sede, en esa sede (0007, 0011).
import {
  falla,
  id,
  ok,
  puede,
  sedesVisibles,
  type ContextoCentro,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import { GESTIONAR, VER } from "../dominio/permisos.ts";
import { limpiarPlan, precioValido } from "../dominio/plan.ts";
import type {
  ErrorDeAbonos,
  NuevoPlan,
  Pagina,
  PaginaDe,
  Plan,
  RepositorioAbonos,
} from "./puertos.ts";

export const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
export const PLAN_INEXISTENTE = falla("plan-inexistente", "Ese plan no existe.");

const enAlgunaSede = (quien: ContextoCentro, permiso: Permiso) =>
  sedesVisibles(quien).some((sede) => puede(quien, permiso, sede));

export const enSede = (quien: ContextoCentro, permiso: Permiso, sedeId: string) =>
  puede(quien, permiso, id<"Sede">(sedeId));

/** Los planes del centro, por nombre, con los precios propios de las sedes que se ven. */
export async function listar(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  filtro: Pagina,
): Promise<Resultado<PaginaDe<Plan>, ErrorDeAbonos>> {
  if (!enAlgunaSede(quien, VER)) return SIN_PERMISO;
  const pagina = await repo.planes(filtro);
  const precios = await repo.preciosDeSede(pagina.elementos.map((p) => p.id));
  return ok({
    ...pagina,
    elementos: pagina.elementos.map((plan) => ({
      ...plan,
      preciosDeSede: precios.get(plan.id) ?? [],
    })),
  });
}

export async function crear(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  plan: NuevoPlan,
): Promise<Resultado<{ id: string }, ErrorDeAbonos>> {
  if (!enAlgunaSede(quien, GESTIONAR)) return SIN_PERMISO;
  const datos = limpiarPlan(plan);
  if (!datos.ok) return datos;
  return ok(await repo.crearPlan(datos.valor));
}

/** Compara la versión (0013). Cambiar el precio no toca las cuotas ya generadas. */
export async function editar(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  { id: planId, version, ...plan }: NuevoPlan & { id: string; version: number },
): Promise<Resultado<{ version: number }, ErrorDeAbonos>> {
  if (!enAlgunaSede(quien, GESTIONAR)) return SIN_PERMISO;
  const datos = limpiarPlan(plan);
  if (!datos.ok) return datos;
  if ((await repo.plan(planId)) === undefined) return PLAN_INEXISTENTE;
  const nueva = await repo.actualizarPlan(planId, version, datos.valor);
  if (nueva === undefined) {
    return falla("cambio-concurrente", "Alguien cambió este plan recién: volvé a cargarlo.");
  }
  return ok({ version: nueva });
}

/** La baja no borra el plan: deja de poder asignarse. */
export async function fijarActivo(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  { id: planId, activo }: { id: string; activo: boolean },
): Promise<Resultado<null, ErrorDeAbonos>> {
  if (!enAlgunaSede(quien, GESTIONAR)) return SIN_PERMISO;
  if ((await repo.plan(planId)) === undefined) return PLAN_INEXISTENTE;
  await repo.fijarActivo(planId, activo);
  return ok(null);
}

/** Con `precio: null`, la sede vuelve al precio general. */
export async function fijarPrecioDeSede(
  repo: RepositorioAbonos,
  quien: ContextoCentro,
  { planId, sedeId, precio }: { planId: string; sedeId: string; precio: number | null },
): Promise<Resultado<null, ErrorDeAbonos>> {
  if (!enSede(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  if ((await repo.plan(planId)) === undefined) return PLAN_INEXISTENTE;
  if (precio === null) {
    await repo.fijarPrecioDeSede(planId, sedeId, null);
    return ok(null);
  }
  const valido = precioValido(precio);
  if (!valido.ok) return valido;
  await repo.fijarPrecioDeSede(planId, sedeId, valido.valor);
  return ok(null);
}
