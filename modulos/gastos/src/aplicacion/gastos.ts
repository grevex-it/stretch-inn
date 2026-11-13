// Casos de uso de los gastos (0022): cargar sin cargar dos veces (regla 7), anular con motivo y
// los de un período de una sede. Cada permiso se controla en la sede del gasto (0007).
import {
  falla,
  id,
  ok,
  puede,
  type ContextoCentro,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import { limpiarGasto, limpiarMotivo, type GastoLimpio } from "../dominio/gasto.ts";
import { ANULAR, CARGAR, VER } from "../dominio/permisos.ts";
import type {
  ErrorDeGastos,
  Gasto,
  Gastos,
  PedidoDeGasto,
  Registro,
  RepositorioGastos,
} from "./puertos.ts";

type Cargado = { id: string; repetido: boolean };

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const CLAVE_USADA = falla("clave-usada", "Esa clave ya se usó en otro gasto: volvé a intentarlo.");
const enSede = (quien: ContextoCentro, permiso: Permiso, sedeId: string) =>
  puede(quien, permiso, id<"Sede">(sedeId));

function registroDe(quien: ContextoCentro, en: Date): Registro {
  const { actor } = quien;
  return actor.tipo === "usuario"
    ? { tipo: "usuario", id: actor.usuarioId, en }
    : { tipo: "soporte", id: actor.operadorId, en };
}

/** El mismo pedido repetido devuelve el gasto que ya se cargó; otro gasto con esa clave, no. */
function repeticion(
  previo: Gasto,
  sedeId: string,
  gasto: GastoLimpio,
): Resultado<Cargado, ErrorDeGastos> {
  const mismo =
    previo.sedeId === sedeId &&
    previo.fecha === gasto.fecha &&
    previo.monto === gasto.monto &&
    previo.categoria === gasto.categoria;
  return mismo ? ok({ id: previo.id, repetido: true }) : CLAVE_USADA;
}

export async function cargar(
  repo: RepositorioGastos,
  quien: ContextoCentro,
  ahora: Date,
  { sedeId, ...datos }: PedidoDeGasto,
): Promise<Resultado<Cargado, ErrorDeGastos>> {
  if (!enSede(quien, CARGAR, sedeId)) return SIN_PERMISO;
  const limpio = limpiarGasto(datos, ahora);
  if (!limpio.ok) return limpio;
  const { claveIdempotencia: clave, ...gasto } = limpio.valor;
  const previo = await repo.gastoPorClave(clave);
  if (previo !== undefined) return repeticion(previo, sedeId, limpio.valor);
  const nuevo = await repo.cargar({ ...gasto, sedeId, clave }, registroDe(quien, ahora));
  if (nuevo !== undefined) return ok({ id: nuevo, repetido: false });
  // El mismo pedido llegó dos veces a la vez: la clave única frenó al segundo.
  const ganador = await repo.gastoPorClave(clave);
  return ganador === undefined ? CLAVE_USADA : repeticion(ganador, sedeId, limpio.valor);
}

export async function anular(
  repo: RepositorioGastos,
  quien: ContextoCentro,
  ahora: Date,
  { id: gastoId, motivo }: { id: string; motivo: string },
): Promise<Resultado<null, ErrorDeGastos>> {
  const limpio = limpiarMotivo(motivo);
  if (!limpio.ok) return limpio;
  const gasto = await repo.gasto(gastoId);
  if (gasto === undefined) return falla("gasto-inexistente", "Ese gasto no existe.");
  if (!enSede(quien, ANULAR, gasto.sedeId)) return SIN_PERMISO;
  if (gasto.anuladoEn !== null) return falla("gasto-anulado", "Ese gasto ya está anulado.");
  await repo.anular(gastoId, limpio.valor, registroDe(quien, ahora));
  return ok(null);
}

export async function delPeriodo(
  repo: RepositorioGastos,
  quien: ContextoCentro,
  filtro: Parameters<Gastos["delPeriodo"]>[1],
): ReturnType<Gastos["delPeriodo"]> {
  if (!enSede(quien, VER, filtro.sedeId)) return SIN_PERMISO;
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  if (!dia.test(filtro.desde) || !dia.test(filtro.hasta) || filtro.desde > filtro.hasta) {
    return falla("periodo-invalido", "Revisá las fechas: desde va antes que hasta.");
  }
  return ok(await repo.delPeriodo(filtro));
}
