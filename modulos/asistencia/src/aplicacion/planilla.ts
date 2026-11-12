// Casos de uso de la planilla de asistencia. El permiso se controla en la sede de la fecha (0007).
// Figuran quienes tenían inscripción vigente al empezar la fecha (agenda).
import {
  falla,
  id,
  ok,
  puede,
  type ContextoCentro,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import { TOMAR, VER } from "../dominio/permisos.ts";
import { limpiarMarcas, puedeTomar, type Marca } from "../dominio/planilla.ts";
import type {
  ErrorDeAsistencia,
  Fecha,
  Pagina,
  Planilla,
  Registro,
  RepositorioAsistencia,
} from "./puertos.ts";

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const INEXISTENTE = falla("fecha-inexistente", "Esa fecha no existe.");

/** La fecha, si existe y quien pide tiene el permiso en su sede. */
async function fechaCon(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  permiso: Permiso,
  fechaId: string,
): Promise<Resultado<Fecha, ErrorDeAsistencia>> {
  const fecha = await repo.fecha(fechaId);
  if (fecha === undefined) return INEXISTENTE;
  if (!puede(quien, permiso, id<"Sede">(fecha.sedeId))) return SIN_PERMISO;
  return ok(fecha);
}

/** Una página de inscriptos con sus alumnos y sus marcas, en tres consultas (regla 8). */
export async function planilla(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  { fechaId, ...pagina }: Pagina & { fechaId: string },
): Promise<Resultado<Planilla, ErrorDeAsistencia>> {
  const fecha = await fechaCon(repo, quien, VER, fechaId);
  if (!fecha.ok) return fecha;
  const { claseId, empiezaEn } = fecha.valor;
  const inscriptos = await repo.inscriptos({ ...pagina, claseId, momento: empiezaEn });
  const ids = inscriptos.elementos.map((i) => i.alumnoId);
  const [alumnos, marcas] = [await repo.alumnos(ids), await repo.marcas(fechaId, ids)];
  return ok({
    fecha: fecha.valor,
    alumnos: {
      ...inscriptos,
      elementos: ids.flatMap((alumnoId) => {
        const alumno = alumnos.get(alumnoId);
        if (alumno === undefined) return [];
        return [{ alumnoId, ...alumno, estado: marcas.get(alumnoId) ?? null }];
      }),
    },
  });
}

function registroDe(quien: ContextoCentro, en: Date): Registro {
  const { actor } = quien;
  return actor.tipo === "usuario"
    ? { tipo: "usuario", id: actor.usuarioId, en }
    : { tipo: "soporte", id: actor.operadorId, en };
}

/** Guarda o corrige las marcas: todas o ninguna, y solo de quienes estaban inscriptos. */
export async function tomar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, marcas }: { fechaId: string; marcas: readonly Marca[] },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  const limpias = limpiarMarcas(marcas);
  if (!limpias.ok) return limpias;
  const fecha = await fechaCon(repo, quien, TOMAR, fechaId);
  if (!fecha.ok) return fecha;
  const regla = puedeTomar(fecha.valor, ahora);
  if (!regla.ok) return regla;
  const estaban = await repo.estabanInscriptos({
    claseId: fecha.valor.claseId,
    momento: fecha.valor.empiezaEn,
    alumnoIds: limpias.valor.map((m) => m.alumnoId),
  });
  if (limpias.valor.some((m) => !estaban.has(m.alumnoId))) {
    return falla("no-inscripto", "Hay un alumno que no estaba inscripto en esta fecha.");
  }
  await repo.guardar(fecha.valor, limpias.valor, registroDe(quien, ahora));
  return ok(null);
}
