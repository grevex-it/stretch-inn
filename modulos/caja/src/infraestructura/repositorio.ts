// Adaptador Drizzle de la caja. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles. La cuota se lee y se marca por la API pública de abonos (regla 4).
import { obtenerCuota, registrarPago, revertirPago } from "@app/abonos";
import { obtenerCentro } from "@app/centros";
import { pesos } from "@app/nucleo";
import { conPuntoDeGuardado, publicar, type Cola, type Transaccion } from "@app/plataforma";
import { EVENTO_PAGO_REGISTRADO } from "../dominio/eventos.ts";
import { and, count, desc, eq, gte, isNull, lt, sql, sum } from "drizzle-orm";
import type { RepositorioCaja } from "../aplicacion/puertos.ts";
import { pagos } from "./esquema.ts";

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

const columnas = {
  id: pagos.id,
  sedeId: pagos.sedeId,
  alumnoId: pagos.alumnoId,
  cuotaId: pagos.cuotaId,
  monto: pagos.monto,
  medio: pagos.medio,
  registradoEn: pagos.registradoEn,
  anuladoEn: pagos.anuladoEn,
  motivoAnulacion: pagos.motivoAnulacion,
};

/** Sin cola (tests que no miran eventos) no se publica nada; la API y el worker siempre la pasan. */
export function repositorioCaja(tx: Transaccion, cola?: Cola): RepositorioCaja {
  return {
    async publicarPagoRegistrado(evento) {
      if (cola === undefined) return;
      await publicar(cola, tx, EVENTO_PAGO_REGISTRADO, evento, {
        claveIdempotencia: evento.pagoId,
      });
    },
    todoONada: (trabajo) => conPuntoDeGuardado(tx, trabajo),
    async zonaHoraria() {
      return (await obtenerCentro(tx))?.zonaHoraria ?? ZONA_POR_DEFECTO;
    },
    cuota: (id) => obtenerCuota(tx, id),
    async registrarPagoDeCuota(pago) {
      return (await registrarPago(tx, pago)).ok;
    },
    revertirPagoDeCuota: (pago) => revertirPago(tx, pago),
    async pagoPorClave(clave) {
      const [fila] = await tx
        .select(columnas)
        .from(pagos)
        .where(eq(pagos.claveIdempotencia, clave));
      return fila;
    },
    registrar: (pago, registro) => registrar(tx, pago, registro),
    async pago(id) {
      const [fila] = await tx.select(columnas).from(pagos).where(eq(pagos.id, id)).for("update");
      return fila;
    },
    async anular(id, motivo, registro) {
      await tx
        .update(pagos)
        .set({
          anuladoEn: registro.en,
          anuladoPorTipo: registro.tipo,
          anuladoPorId: registro.id,
          motivoAnulacion: motivo,
        })
        .where(and(eq(pagos.id, id), isNull(pagos.anuladoEn)));
    },
    delDia: (filtro) => delDia(tx, filtro),
  };
}

/** La clave única por centro es la barrera: el mismo cobro repetido no deja dos filas. */
async function registrar(
  tx: Transaccion,
  ...[{ clave, ...pago }, registro]: Parameters<RepositorioCaja["registrar"]>
): Promise<string | undefined> {
  const [fila] = await tx
    .insert(pagos)
    .values({
      ...pago,
      centroId: sql`app_centro_actual()`,
      claveIdempotencia: clave,
      registradoPorTipo: registro.tipo,
      registradoPorId: registro.id,
      registradoEn: registro.en,
    })
    .onConflictDoNothing()
    .returning({ id: pagos.id });
  return fila?.id;
}

async function delDia(
  tx: Transaccion,
  { sedeId, desde, hasta, pagina, porPagina }: Parameters<RepositorioCaja["delDia"]>[0],
): ReturnType<RepositorioCaja["delDia"]> {
  const donde = and(
    eq(pagos.sedeId, sedeId),
    gte(pagos.registradoEn, desde),
    lt(pagos.registradoEn, hasta),
  );
  const elementos = await tx
    .select(columnas)
    .from(pagos)
    .where(donde)
    .orderBy(desc(pagos.registradoEn), desc(pagos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [totales] = await tx.select({ total: count() }).from(pagos).where(donde);
  const [vigentes] = await tx
    .select({ cobrado: sum(pagos.monto).mapWith(Number) })
    .from(pagos)
    .where(and(donde, isNull(pagos.anuladoEn)));
  return {
    pagina,
    porPagina,
    total: totales?.total ?? 0,
    elementos,
    cobrado: pesos(vigentes?.cobrado ?? 0),
  };
}
