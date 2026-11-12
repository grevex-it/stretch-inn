// Adaptador Drizzle de las cuotas. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles. El alumno se lee por la API pública de personas (regla 4).
import { obtenerAlumno } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, count, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { cuotas } from "./esquema.ts";

type RepositorioCuotas = Pick<
  RepositorioAbonos,
  "alumno" | "generarCuota" | "cuota" | "anularCuota" | "marcarPagada" | "cuotasDeAlumno"
>;

const columnas = {
  id: cuotas.id,
  alumnoId: cuotas.alumnoId,
  planId: cuotas.planId,
  sedeId: cuotas.sedeId,
  desde: cuotas.desde,
  hasta: cuotas.hasta,
  monto: cuotas.monto,
  pagadaEn: cuotas.pagadaEn,
};

const vigente = (id: string) => and(eq(cuotas.id, id), isNull(cuotas.anuladaEn));

export function repositorioCuotas(tx: Transaccion): RepositorioCuotas {
  return {
    async alumno(id) {
      const alumno = await obtenerAlumno(tx, id);
      return alumno === undefined ? undefined : { activo: alumno.activo };
    },
    generarCuota: (cuota) => generarCuota(tx, cuota),
    async cuota(id, bloquear = false) {
      const consulta = tx.select(columnas).from(cuotas).where(vigente(id));
      const [fila] = bloquear ? await consulta.for("update") : await consulta;
      return fila;
    },
    async anularCuota(id, ahora) {
      await tx.update(cuotas).set({ anuladaEn: ahora }).where(vigente(id));
    },
    async marcarPagada(id, pagoId, en) {
      await tx.update(cuotas).set({ pagoId, pagadaEn: en }).where(vigente(id));
    },
    async cuotasDeAlumno({ alumnoId, sedeIds, pagina, porPagina }) {
      if (sedeIds.length === 0) return { pagina, porPagina, total: 0, elementos: [] };
      const donde = and(
        eq(cuotas.alumnoId, alumnoId),
        inArray(cuotas.sedeId, [...sedeIds]),
        isNull(cuotas.anuladaEn),
      );
      const elementos = await tx
        .select(columnas)
        .from(cuotas)
        .where(donde)
        .orderBy(desc(cuotas.desde), desc(cuotas.creadaEn))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(cuotas).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
  };
}

/** El id de la cuota nueva, o undefined si pisa otro ciclo vigente del alumno. */
async function generarCuota(
  tx: Transaccion,
  cuota: Parameters<RepositorioAbonos["generarCuota"]>[0],
): Promise<string | undefined> {
  // De a una por alumno hasta el fin de la transacción: así dos altas a la vez no se pisan.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`cuotas:${cuota.alumnoId}`}))`);
  const [pisa] = await tx
    .select({ id: cuotas.id })
    .from(cuotas)
    .where(
      and(
        eq(cuotas.alumnoId, cuota.alumnoId),
        isNull(cuotas.anuladaEn),
        lt(cuotas.desde, cuota.hasta),
        gt(cuotas.hasta, cuota.desde),
      ),
    )
    .limit(1);
  if (pisa !== undefined) return undefined;
  // El índice único parcial (alumno, desde vigente) es la última barrera.
  const [fila] = await tx
    .insert(cuotas)
    .values({ ...cuota, centroId: sql`app_centro_actual()` })
    .onConflictDoNothing()
    .returning({ id: cuotas.id });
  return fila?.id;
}
