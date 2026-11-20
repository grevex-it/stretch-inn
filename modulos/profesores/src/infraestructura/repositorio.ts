// Adaptador Drizzle de los profes y sus tarifas. Corre dentro de enContexto: RLS limita al centro
// y a las sedes visibles. El profe es un usuario del equipo, leído por la API pública de identidad
// (regla 4); la zona del centro, por la de centros.
import { obtenerCentro } from "@app/centros";
import { listarUsuariosActivos, obtenerUsuarios } from "@app/identidad";
import type { Transaccion } from "@app/plataforma";
import { and, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Alcance, RepositorioProfesores } from "../aplicacion/puertos.ts";
import { tarifasDelCentro, tarifasDeSede, tiposDeProfe } from "./esquema.ts";

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

const diaDe = (instante: Date, zona: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);

/** La tabla y la condición del alcance: de una sede, o de todo el centro. */
function delAlcance({ sedeId, profeId }: Alcance) {
  const tabla = sedeId === null ? tarifasDelCentro : tarifasDeSede;
  const profe = profeId === null ? isNull(tabla.profeId) : eq(tabla.profeId, profeId);
  const donde: SQL | undefined =
    sedeId === null ? profe : and(profe, eq(tarifasDeSede.sedeId, sedeId));
  return { tabla, donde };
}

function tarifas(
  tx: Transaccion,
): Pick<
  RepositorioProfesores,
  "bloquearAlcance" | "ultimaAbierta" | "cerrar" | "guardarTarifa" | "tarifas"
> {
  return {
    async bloquearAlcance({ sedeId, profeId }) {
      const clave = `tarifas:${sedeId ?? "centro"}:${profeId ?? "todos"}`;
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${clave} || app_centro_actual()::text, 0))`,
      );
    },
    async ultimaAbierta(alcance) {
      const { tabla, donde } = delAlcance(alcance);
      const [fila] = await tx
        .select({
          id: tabla.id,
          profeId: tabla.profeId,
          monto: tabla.monto,
          desde: tabla.desde,
          hasta: tabla.hasta,
        })
        .from(tabla)
        .where(and(donde, isNull(tabla.hasta)))
        .orderBy(desc(tabla.desde))
        .limit(1);
      return fila === undefined ? undefined : { ...fila, sedeId: alcance.sedeId };
    },
    async cerrar(alcance, id, hasta) {
      const { tabla } = delAlcance(alcance);
      await tx.update(tabla).set({ hasta }).where(eq(tabla.id, id));
    },
    async guardarTarifa({ sedeId, profeId }, { monto, desde }) {
      const centroId = sql`app_centro_actual()`;
      if (sedeId === null)
        await tx.insert(tarifasDelCentro).values({ centroId, profeId, monto, desde });
      else await tx.insert(tarifasDeSede).values({ centroId, sedeId, profeId, monto, desde });
    },
    tarifas: (filtro) => listarTarifas(tx, filtro),
  };
}

/** Las de todo el centro (sedeId null) o las de una sede, la más nueva primero. */
async function listarTarifas(
  tx: Transaccion,
  { sedeId, pagina, porPagina }: Parameters<RepositorioProfesores["tarifas"]>[0],
): ReturnType<RepositorioProfesores["tarifas"]> {
  const { tabla, donde } =
    sedeId === null
      ? { tabla: tarifasDelCentro, donde: undefined }
      : { tabla: tarifasDeSede, donde: eq(tarifasDeSede.sedeId, sedeId) };
  const elementos = await tx
    .select({
      id: tabla.id,
      profeId: tabla.profeId,
      monto: tabla.monto,
      desde: tabla.desde,
      hasta: tabla.hasta,
    })
    .from(tabla)
    .where(donde)
    .orderBy(desc(tabla.desde), sql`${tabla.profeId} nulls last`, desc(tabla.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [total] = await tx.select({ total: count() }).from(tabla).where(donde);
  return {
    pagina,
    porPagina,
    total: total?.total ?? 0,
    elementos: elementos.map((t) => ({ ...t, sedeId })),
  };
}

export function repositorioProfesores(tx: Transaccion): RepositorioProfesores {
  return {
    ...tarifas(tx),
    async hoy(ahora) {
      return diaDe(ahora, (await obtenerCentro(tx))?.zonaHoraria ?? ZONA_POR_DEFECTO);
    },
    equipo: (pagina) => listarUsuariosActivos(tx, pagina),
    async profeValido(id) {
      const [usuario] = await obtenerUsuarios(tx, [id]);
      return usuario?.activo === true;
    },
    async tipos(profeIds) {
      if (profeIds.length === 0) return new Map();
      const filas = await tx
        .select({ profeId: tiposDeProfe.profeId, tipo: tiposDeProfe.tipo })
        .from(tiposDeProfe)
        .where(inArray(tiposDeProfe.profeId, [...profeIds]));
      return new Map(filas.map((f) => [f.profeId, f.tipo]));
    },
    async guardarTipo(profeId, tipo) {
      await tx
        .insert(tiposDeProfe)
        .values({ profeId, tipo, centroId: sql`app_centro_actual()` })
        .onConflictDoUpdate({ target: tiposDeProfe.profeId, set: { tipo } });
    },
  };
}
