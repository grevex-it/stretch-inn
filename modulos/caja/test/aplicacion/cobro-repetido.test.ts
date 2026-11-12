// El mismo cobro dos veces a la vez, sin base: el segundo pedido no vio el pago del primero al
// empezar, pero cuando lee la cuota ya está pagada por ese mismo pago. Tiene que devolver el
// pago que ya se hizo (regla 7), no «cuota pagada».
import { id, pesos, type ContextoCentro } from "@app/nucleo";
import { describe, expect, it } from "vitest";
import { cobrarCuota } from "../../src/aplicacion/cobros.ts";
import type { Pago, RepositorioCaja } from "../../src/aplicacion/puertos.ts";

const SEDE = "sede-norte";
const quien: ContextoCentro = {
  centroId: id<"Centro">("centro-1"),
  actor: { tipo: "usuario", usuarioId: id<"Usuario">("usuario-1") },
  permisosPorSede: new Map([[id<"Sede">(SEDE), new Set(["caja.cobrar" as const])]]),
};
const PAGO: Pago = {
  id: "pago-del-primero",
  sedeId: SEDE,
  alumnoId: "ana",
  cuotaId: "cuota-1",
  monto: pesos(28_000),
  medio: "efectivo",
  registradoEn: new Date("2026-11-12T13:00:00Z"),
  anuladoEn: null,
  motivoAnulacion: null,
};

/** El primer pedido confirma justo después de que el segundo buscó la clave. */
function conElPrimeroRecienConfirmado(): RepositorioCaja {
  let busquedas = 0;
  const noUsar = () => Promise.reject(new Error("El segundo pedido no tendría que llegar acá."));
  return {
    pagoPorClave: () => Promise.resolve(busquedas++ === 0 ? undefined : PAGO),
    cuota: () =>
      Promise.resolve({
        id: "cuota-1",
        alumnoId: "ana",
        sedeId: SEDE,
        monto: pesos(28_000),
        pagadaEn: PAGO.registradoEn,
      }),
    todoONada: noUsar,
    zonaHoraria: noUsar,
    registrarPagoDeCuota: noUsar,
    revertirPagoDeCuota: noUsar,
    publicarPagoRegistrado: noUsar,
    registrar: noUsar,
    pago: noUsar,
    anular: noUsar,
    delDia: noUsar,
  };
}

describe("cobrarCuota con la misma clave a la vez", () => {
  it("si la cuota ya la pagó el mismo cobro, devuelve ese pago", async () => {
    const resultado = await cobrarCuota(conElPrimeroRecienConfirmado(), quien, new Date(), {
      cuotaId: "cuota-1",
      medio: "efectivo",
      claveIdempotencia: "cobro-de-prueba-1",
    });
    expect(resultado).toEqual({
      ok: true,
      valor: { id: "pago-del-primero", monto: 28_000, repetido: true },
    });
  });
});
