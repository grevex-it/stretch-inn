// Adaptador Drizzle de las cuotas. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles. El alumno se lee por la API pública de personas (regla 4).
import { obtenerAlumno } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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
  periodo: cuotas.periodo,
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
    async generarCuota(cuota) {
      // El índice único parcial (alumno, mes vigente) es la barrera: si choca, no hay fila.
      const [fila] = await tx
        .insert(cuotas)
        .values({ ...cuota, centroId: sql`app_centro_actual()` })
        .onConflictDoNothing()
        .returning({ id: cuotas.id });
      return fila?.id;
    },
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
        .orderBy(desc(cuotas.periodo), desc(cuotas.creadaEn))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(cuotas).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
  };
}
