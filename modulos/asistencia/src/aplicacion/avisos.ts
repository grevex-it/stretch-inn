// Casos de uso de los avisos de ausencia. El permiso se controla en la sede de la fecha (0007).
// El aviso libera el lugar del alumno en esa fecha; recuperar no depende de él (0020).
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { puedeAvisar } from "../dominio/aviso.ts";
import { AVISAR } from "../dominio/permisos.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type { ErrorDeAsistencia, RepositorioAsistencia } from "./puertos.ts";
import { lugaresDe } from "./recuperaciones.ts";

const INEXISTENTE = falla("aviso-inexistente", "Ese aviso no existe o ya se anuló.");

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
