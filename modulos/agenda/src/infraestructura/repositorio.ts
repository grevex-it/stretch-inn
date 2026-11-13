// Adaptador Drizzle de la agenda. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles, así que acá no se filtra por centro a mano. Sin consultas dentro de un bucle (regla 8).
import { obtenerCentro } from "@app/centros";
import type { Transaccion } from "@app/plataforma";
import { and, asc, between, count, eq, gt, inArray, sql } from "drizzle-orm";
import type { DatosDeClase } from "../dominio/clase.ts";
import type { OcupadasDeMas, RepositorioAgenda } from "../aplicacion/puertos.ts";
import { clases, ocurrencias } from "./esquema.ts";
import { lugaresFuturos } from "./lugares-futuros.ts";

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

const columnasDeClase = {
  id: clases.id,
  sedeId: clases.sedeId,
  nombre: clases.nombre,
  dia: clases.dia,
  hora: clases.hora,
  duracionMinutos: clases.duracionMinutos,
  cupo: clases.cupo,
  inscriptos: clases.inscriptos,
  activa: clases.activa,
  version: clases.version,
};

const conAlta = { ...columnasDeClase, creadaEn: clases.creadoEn };

/** Un arreglo de Postgres armado como literal: `{a,b}`. */
const arreglo = (valores: readonly string[], tipo: "uuid" | "timestamptz") =>
  sql`${`{${valores.join(",")}}`}::${sql.raw(tipo)}[]`;

function lecturas(
  tx: Transaccion,
): Pick<RepositorioAgenda, "zonaHoraria" | "clases" | "clase" | "clasesActivasDeSede"> {
  return {
    async zonaHoraria() {
      return (await obtenerCentro(tx))?.zonaHoraria ?? ZONA_POR_DEFECTO;
    },
    async clases({ pagina, porPagina, sedeIds }) {
      if (sedeIds.length === 0) return { pagina, porPagina, total: 0, elementos: [] };
      const donde = inArray(clases.sedeId, [...sedeIds]);
      const elementos = await tx
        .select(columnasDeClase)
        .from(clases)
        .where(donde)
        .orderBy(asc(clases.dia), asc(clases.hora), asc(clases.nombre), asc(clases.id))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(clases).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
    async clase(id, bloquear = false) {
      const consulta = tx.select(conAlta).from(clases).where(eq(clases.id, id));
      const [clase] = bloquear ? await consulta.for("update") : await consulta;
      return clase;
    },
    async clasesActivasDeSede(sedeId) {
      return tx
        .select(conAlta)
        .from(clases)
        .where(and(eq(clases.sedeId, sedeId), eq(clases.activa, true)));
    },
  };
}

function escriturasDeClases(
  tx: Transaccion,
): Pick<RepositorioAgenda, "crearClase" | "actualizarClase" | "fijarActiva"> {
  return {
    async crearClase(sedeId, datos: DatosDeClase) {
      const [fila] = await tx
        .insert(clases)
        .values({ ...datos, sedeId, centroId: sql`app_centro_actual()` })
        .returning({ id: clases.id });
      if (fila === undefined) throw new Error("La clase no se guardó.");
      return fila;
    },
    async actualizarClase(id, version, datos) {
      const [fila] = await tx
        .update(clases)
        .set({ ...datos, version: sql`${clases.version} + 1` })
        .where(and(eq(clases.id, id), eq(clases.version, version)))
        .returning({ version: clases.version });
      return fila?.version;
    },
    async fijarActiva(id, activa) {
      await tx
        .update(clases)
        .set({ activa, version: sql`${clases.version} + 1` })
        .where(eq(clases.id, id));
    },
  };
}

function lecturasDeFechas(
  tx: Transaccion,
): Pick<RepositorioAgenda, "fechas" | "fechasFuturas" | "fecha"> {
  return {
    async fechas({ pagina, porPagina, sedeId, desde, hasta }) {
      const donde = and(eq(ocurrencias.sedeId, sedeId), between(ocurrencias.fecha, desde, hasta));
      const elementos = await tx
        .select({
          id: ocurrencias.id,
          claseId: ocurrencias.claseId,
          nombre: clases.nombre,
          cupo: clases.cupo,
          inscriptos: clases.inscriptos,
          fecha: ocurrencias.fecha,
          empiezaEn: ocurrencias.empiezaEn,
          terminaEn: ocurrencias.terminaEn,
          cancelada: ocurrencias.cancelada,
        })
        .from(ocurrencias)
        .innerJoin(clases, eq(clases.id, ocurrencias.claseId))
        .where(donde)
        .orderBy(asc(ocurrencias.empiezaEn), asc(clases.nombre), asc(ocurrencias.id))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(ocurrencias).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
    async fechasFuturas(claseId, ahora) {
      return tx
        .select({ id: ocurrencias.id, fecha: ocurrencias.fecha })
        .from(ocurrencias)
        .where(and(eq(ocurrencias.claseId, claseId), gt(ocurrencias.empiezaEn, ahora)));
    },
    async fecha(id) {
      const [fila] = await tx
        .select({ sedeId: ocurrencias.sedeId, empiezaEn: ocurrencias.empiezaEn })
        .from(ocurrencias)
        .where(eq(ocurrencias.id, id));
      return fila;
    },
  };
}

function escriturasDeFechas(
  tx: Transaccion,
): Pick<RepositorioAgenda, "guardarFechas" | "moverFechas" | "borrarFechas" | "fijarCancelada"> {
  return {
    async guardarFechas(nuevas) {
      if (nuevas.length === 0) return;
      await tx
        .insert(ocurrencias)
        .values(nuevas.map((fecha) => ({ ...fecha, centroId: sql`app_centro_actual()` })))
        .onConflictDoNothing({ target: [ocurrencias.claseId, ocurrencias.fecha] });
    },
    async moverFechas(cambios) {
      if (cambios.length === 0) return;
      const ids = arreglo(
        cambios.map((c) => c.id),
        "uuid",
      );
      const empiezan = arreglo(
        cambios.map((c) => c.empiezaEn.toISOString()),
        "timestamptz",
      );
      const terminan = arreglo(
        cambios.map((c) => c.terminaEn.toISOString()),
        "timestamptz",
      );
      await tx.execute(sql`
        update ocurrencias o set empieza_en = v.empieza, termina_en = v.termina
        from unnest(${ids}, ${empiezan}, ${terminan}) as v (id, empieza, termina)
        where o.id = v.id`);
    },
    async borrarFechas(ids) {
      if (ids.length === 0) return;
      await tx.delete(ocurrencias).where(inArray(ocurrencias.id, [...ids]));
    },
    async fijarCancelada(id, cancelada) {
      await tx.update(ocurrencias).set({ cancelada }).where(eq(ocurrencias.id, id));
    },
  };
}

export function repositorioAgenda(
  tx: Transaccion,
  ocupadasDeMas?: OcupadasDeMas,
): RepositorioAgenda {
  return {
    ...lecturas(tx),
    ...escriturasDeClases(tx),
    ...lecturasDeFechas(tx),
    ...escriturasDeFechas(tx),
    ...lugaresFuturos(tx, ocupadasDeMas),
  };
}
