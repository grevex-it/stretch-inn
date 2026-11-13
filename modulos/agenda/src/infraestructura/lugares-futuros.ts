// Las recuperaciones de las fechas futuras de una clase, por el puerto de asistencia: para que
// inscribir o bajar el cupo no deje una fecha con más gente que lugares.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, gt } from "drizzle-orm";
import type { OcupadasDeMas, RepositorioAgenda } from "../aplicacion/puertos.ts";
import { ocurrencias } from "./esquema.ts";

/**
 * Una clase semanal tiene a lo sumo 100 fechas en casi dos años, y solo hay recuperaciones en
 * fechas ya armadas (alguien miró esa semana): alcanza con las primeras 100.
 */
const MAXIMO_DE_FECHAS = 100;

export function lugaresFuturos(
  tx: Transaccion,
  ocupadasDeMas: OcupadasDeMas | undefined,
): Pick<RepositorioAgenda, "masOcupadaFutura"> {
  return {
    async masOcupadaFutura(claseId, ahora) {
      if (ocupadasDeMas === undefined) return undefined;
      const futuras = await tx
        .select({ id: ocurrencias.id, fecha: ocurrencias.fecha })
        .from(ocurrencias)
        .where(
          and(
            eq(ocurrencias.claseId, claseId),
            gt(ocurrencias.empiezaEn, ahora),
            eq(ocurrencias.cancelada, false),
          ),
        )
        .orderBy(asc(ocurrencias.empiezaEn))
        .limit(MAXIMO_DE_FECHAS);
      if (futuras.length === 0) return undefined;
      const deMas = await ocupadasDeMas(tx, { ocurrenciaIds: futuras.map((f) => f.id) });
      let mas: { fecha: string; deMas: number } | undefined;
      for (const { id, fecha } of futuras) {
        const suyas = deMas.get(id) ?? 0;
        if (suyas > (mas?.deMas ?? 0)) mas = { fecha, deMas: suyas };
      }
      return mas;
    },
  };
}
