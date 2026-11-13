// Las recuperaciones de las fechas futuras de una clase, por el puerto de asistencia: para que
// inscribir o bajar el cupo no deje una fecha con más gente que lugares.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { OcupadasDeMas, RepositorioAgenda } from "../aplicacion/puertos.ts";
import { ocurrencias } from "./esquema.ts";

/**
 * Solo hay recuperaciones en fechas ya armadas (alguien miró esa semana): las primeras 100 fechas
 * futuras alcanzan para una clase (casi dos años) y para las de una sede (varias semanas).
 */
const MAXIMO_DE_FECHAS = 100;

export function lugaresFuturos(
  tx: Transaccion,
  ocupadasDeMas: OcupadasDeMas | undefined,
): Pick<RepositorioAgenda, "masOcupadaFutura"> {
  return {
    async masOcupadaFutura(claseIds, ahora) {
      if (ocupadasDeMas === undefined || claseIds.length === 0) return undefined;
      const futuras = await tx
        .select({ id: ocurrencias.id, claseId: ocurrencias.claseId, fecha: ocurrencias.fecha })
        .from(ocurrencias)
        .where(
          and(
            inArray(ocurrencias.claseId, [...claseIds]),
            gt(ocurrencias.empiezaEn, ahora),
            eq(ocurrencias.cancelada, false),
          ),
        )
        .orderBy(asc(ocurrencias.empiezaEn), asc(ocurrencias.id))
        .limit(MAXIMO_DE_FECHAS);
      if (futuras.length === 0) return undefined;
      const deMas = await ocupadasDeMas(tx, { ocurrenciaIds: futuras.map((f) => f.id) });
      let mas: { claseId: string; fecha: string; deMas: number } | undefined;
      for (const { id, claseId, fecha } of futuras) {
        const suyas = deMas.get(id) ?? 0;
        if (suyas > (mas?.deMas ?? 0)) mas = { claseId, fecha, deMas: suyas };
      }
      return mas;
    },
  };
}
