// Casos de uso de la caja: cobrar una cuota sin cobrar dos veces (regla 7), anular un pago y el
// día de caja de una sede. El pago y la cuota pagada van en la misma transacción.
import {
  falla,
  id,
  ok,
  puede,
  type ContextoCentro,
  type Dinero,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import { diaDeCaja, limpiarClave, limpiarMotivo, medioValido } from "../dominio/cobro.ts";
import { ANULAR, COBRAR, VER } from "../dominio/permisos.ts";
import type { ErrorDeCaja, Pago, Pagina, PaginaDe, Registro, RepositorioCaja } from "./puertos.ts";

type Cobro = { id: string; monto: Dinero; repetido: boolean };

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const enSede = (quien: ContextoCentro, permiso: Permiso, sedeId: string) =>
  puede(quien, permiso, id<"Sede">(sedeId));

function registroDe(quien: ContextoCentro, en: Date): Registro {
  const { actor } = quien;
  return actor.tipo === "usuario"
    ? { tipo: "usuario", id: actor.usuarioId, en }
    : { tipo: "soporte", id: actor.operadorId, en };
}

/** El mismo pedido repetido devuelve el pago que ya se hizo; otra cuota con esa clave, no. */
function repeticion(pago: Pago, cuotaId: string): Resultado<Cobro, ErrorDeCaja> {
  if (pago.cuotaId !== cuotaId) {
    return falla("clave-usada", "Esa clave ya se usó en otro cobro: volvé a intentarlo.");
  }
  return ok({ id: pago.id, monto: pago.monto, repetido: true });
}

export async function cobrarCuota(
  repo: RepositorioCaja,
  quien: ContextoCentro,
  ahora: Date,
  {
    cuotaId,
    medio,
    claveIdempotencia,
  }: { cuotaId: string; medio: string; claveIdempotencia: string },
): Promise<Resultado<Cobro, ErrorDeCaja>> {
  if (!medioValido(medio)) return falla("medio-invalido", "Elegí el medio de pago.");
  const clave = limpiarClave(claveIdempotencia);
  if (!clave.ok) return clave;
  const previo = await repo.pagoPorClave(clave.valor);
  if (previo !== undefined) return repeticion(previo, cuotaId);
  const cuota = await repo.cuota(cuotaId);
  if (cuota === undefined) return falla("cuota-inexistente", "Esa cuota no existe o se anuló.");
  if (!enSede(quien, COBRAR, cuota.sedeId)) return SIN_PERMISO;
  if (cuota.pagadaEn !== null) return falla("cuota-pagada", "Esa cuota ya está pagada.");
  const { alumnoId, sedeId, monto } = cuota;
  // Si la cuota no se puede marcar (otro cobro la pagó recién), el pago tampoco queda.
  return repo.todoONada(async (): Promise<Resultado<Cobro, ErrorDeCaja>> => {
    const pagoId = await repo.registrar(
      { sedeId, alumnoId, cuotaId, monto, medio, clave: clave.valor },
      registroDe(quien, ahora),
    );
    if (pagoId === undefined) {
      // El mismo cobro llegó dos veces a la vez: la clave única frenó al segundo.
      const ganador = await repo.pagoPorClave(clave.valor);
      return ganador === undefined
        ? falla("clave-usada", "Volvé a intentarlo.")
        : repeticion(ganador, cuotaId);
    }
    if (!(await repo.registrarPagoDeCuota({ cuotaId, pagoId, en: ahora }))) {
      return falla("cuota-pagada", "Esa cuota ya está pagada.");
    }
    return ok({ id: pagoId, monto, repetido: false });
  });
}

/** Con motivo; la cuota vuelve a estar sin pagar. No borra el pago. */
export async function anular(
  repo: RepositorioCaja,
  quien: ContextoCentro,
  ahora: Date,
  { id: pagoId, motivo }: { id: string; motivo: string },
): Promise<Resultado<null, ErrorDeCaja>> {
  const limpio = limpiarMotivo(motivo);
  if (!limpio.ok) return limpio;
  const pago = await repo.pago(pagoId);
  if (pago === undefined) return falla("pago-inexistente", "Ese pago no existe.");
  if (!enSede(quien, ANULAR, pago.sedeId)) return SIN_PERMISO;
  if (pago.anuladoEn !== null) return falla("pago-anulado", "Ese pago ya está anulado.");
  await repo.anular(pagoId, limpio.valor, registroDe(quien, ahora));
  await repo.revertirPagoDeCuota({ cuotaId: pago.cuotaId, pagoId });
  return ok(null);
}

/** Los pagos del día (en la zona del centro) de una sede, y lo cobrado sin los anulados. */
export async function delDia(
  repo: RepositorioCaja,
  quien: ContextoCentro,
  { sedeId, dia, ...pagina }: Pagina & { sedeId: string; dia: string },
): Promise<Resultado<PaginaDe<Pago> & { cobrado: Dinero }, ErrorDeCaja>> {
  if (!enSede(quien, VER, sedeId)) return SIN_PERMISO;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dia)) {
    return falla("dia-invalido", "El día va como AAAA-MM-DD.");
  }
  const { desde, hasta } = diaDeCaja(dia, await repo.zonaHoraria());
  return ok(await repo.delDia({ ...pagina, sedeId, desde, hasta }));
}
