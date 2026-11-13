// Casos de uso de los avisos de ausencia. El permiso se controla en la sede de la fecha (0007).
// El aviso libera el lugar del alumno en esa fecha; recuperar no depende de él (0020).
import { falla, id, ok, puede, type ContextoCentro, type Resultado } from "@app/nucleo";
import { fechasDelPeriodo, periodoValido, puedeAvisar } from "../dominio/aviso.ts";
import { AVISAR } from "../dominio/permisos.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type { ErrorDeAsistencia, RepositorioAsistencia } from "./puertos.ts";
import { lugaresDe } from "./recuperaciones.ts";

const INEXISTENTE = falla("aviso-inexistente", "Ese aviso no existe o ya se anuló.");
const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");

/** Solo quien estaba inscripto, antes del inicio y en una fecha no cancelada. */
export async function avisar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, alumnoId }: { fechaId: string; alumnoId: string },
): Promise<Resultado<{ id: string }, ErrorDeAsistencia>> {
  const fecha = await fechaCon(repo, quien, AVISAR, fechaId);
  if (!fecha.ok) return fecha;
  const regla = puedeAvisar(fecha.valor, ahora);
  if (!regla.ok) return regla;
  const { claseId, empiezaEn } = fecha.valor;
  const estaban = await repo.estabanInscriptos({
    claseId,
    momento: empiezaEn,
    alumnoIds: [alumnoId],
  });
  if (!estaban.has(alumnoId)) {
    return falla("no-inscripto", "Ese alumno no está inscripto en esta fecha.");
  }
  const id = await repo.avisar(fecha.valor, alumnoId, registroDe(quien, ahora));
  if (id === undefined) return falla("ya-avisado", "Ese alumno ya avisó que no viene.");
  return ok({ id });
}

/**
 * El viaje (0022): avisa en una sola vez las fechas de su horario fijo en la sede dentro del
 * período que todavía no empezaron. Las que ya tenían aviso no cuentan: repetirlo no duplica.
 */
export async function avisarPeriodo(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  {
    alumnoId,
    sedeId,
    desde,
    hasta,
  }: { alumnoId: string; sedeId: string; desde: string; hasta: string },
): Promise<Resultado<{ avisos: number }, ErrorDeAsistencia>> {
  if (!puede(quien, AVISAR, id<"Sede">(sedeId))) return SIN_PERMISO;
  if (!periodoValido(desde, hasta)) {
    return falla("periodo-invalido", "Revisá las fechas: desde va antes que hasta.");
  }
  const fechas = fechasDelPeriodo(
    await repo.fechasDeAlumno({ alumnoId, sedeId, desde }),
    hasta,
    ahora,
  );
  if (fechas.length === 0) {
    return falla("sin-fechas", "En ese período no tiene clases de su horario fijo para avisar.");
  }
  const conSede = fechas.map((f) => ({ id: f.id, sedeId }));
  return ok({ avisos: await repo.avisarVarias(conSede, alumnoId, registroDe(quien, ahora)) });
}

/** Anular no borra el aviso: lo marca. También solo antes del inicio. */
export async function anular(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { id }: { id: string },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  const aviso = await repo.aviso(id);
  if (aviso === undefined) return INEXISTENTE;
  const fecha = await fechaCon(repo, quien, AVISAR, aviso.ocurrenciaId);
  if (!fecha.ok) return fecha.error.codigo === "fecha-inexistente" ? INEXISTENTE : fecha;
  const regla = puedeAvisar(fecha.valor, ahora);
  if (!regla.ok) return regla;
  // Volver ocupa un lugar: si una recuperación ya lo tomó, no hay dónde volver.
  await repo.bloquearFecha(fecha.valor.id);
  if ((await lugaresDe(repo, fecha.valor)) < 1) {
    return falla(
      "sin-lugar",
      "Ese lugar ya lo ocupó una recuperación: no se puede anular el aviso.",
    );
  }
  if (!(await repo.anularAviso(id, ahora))) return INEXISTENTE;
  return ok(null);
}
