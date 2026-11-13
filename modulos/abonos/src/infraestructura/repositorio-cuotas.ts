// Adaptador Drizzle de las cuotas. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles. El alumno y su horario fijo se leen por las API públicas de personas y agenda (regla 4).
import { fechasDeAlumno } from "@app/agenda";
import { obtenerAlumno } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, count, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { cuotas } from "./esquema.ts";

type RepositorioCuotas = Pick<
  RepositorioAbonos,
  | "alumno"
  | "bloquearAlumno"
  | "ultimaCuota"
  | "cuotaEmpezada"
  | "fechasDeAlumno"
  | "generarCuota"
  | "cuota"
  | "anularCuota"
  | "marcarPagada"
  | "cuotasDeAlumno"
>;

const columnas = {
  id: cuotas.id,
  alumnoId: cuotas.alumnoId,
  planId: cuotas.planId,
  sedeId: cuotas.sedeId,
  desde: cuotas.desde,
  clases: cuotas.clases,
  monto: cuotas.monto,
  pagadaEn: cuotas.pagadaEn,
  pagoId: cuotas.pagoId,
};

const vigente = (id: string) => and(eq(cuotas.id, id), isNull(cuotas.anuladaEn));

/** Lo que hace falta para que las cuotas de un alumno no se pisen (0020). */
function delAlumno(
  tx: Transaccion,
): Pick<RepositorioAbonos, "bloquearAlumno" | "ultimaCuota" | "cuotaEmpezada" | "fechasDeAlumno"> {
  return {
    async bloquearAlumno(alumnoId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`cuotas:${alumnoId}`}))`);
    },
    async ultimaCuota(alumnoId) {
      const [fila] = await tx
        .select(columnas)
        .from(cuotas)
        .where(and(eq(cuotas.alumnoId, alumnoId), isNull(cuotas.anuladaEn)))
        .orderBy(desc(cuotas.desde))
        .limit(1);
      return fila;
    },
    async cuotaEmpezada({ alumnoId, sedeId, hoy }) {
      const [fila] = await tx
        .select(columnas)
        .from(cuotas)
        .where(
          and(
            eq(cuotas.alumnoId, alumnoId),
            eq(cuotas.sedeId, sedeId),
            isNull(cuotas.anuladaEn),
            lte(cuotas.desde, hoy),
          ),
        )
        .orderBy(desc(cuotas.desde))
        .limit(1);
      return fila;
    },
    async fechasDeAlumno(pedido) {
      const fechas = await fechasDeAlumno(tx, pedido);
      return fechas.map(({ fecha, terminaEn }) => ({ fecha, terminaEn }));
    },
  };
}

export function repositorioCuotas(tx: Transaccion): RepositorioCuotas {
  return {
    async alumno(id) {
      const alumno = await obtenerAlumno(tx, id);
      return alumno === undefined ? undefined : { activo: alumno.activo };
    },
    ...delAlumno(tx),
    async generarCuota(cuota) {
      // El índice único parcial (alumno, desde vigente) es la última barrera.
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
        .orderBy(desc(cuotas.desde), desc(cuotas.creadaEn))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(cuotas).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
  };
}
