// Casos de uso de las recuperaciones. Todo lo que mueve los lugares de una fecha la toma antes
// (bloqueo por fecha, 0013): dos reservas por el último lugar no entran las dos.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { RECUPERAR } from "../dominio/permisos.ts";
import { lugaresLibres, puedeRecuperar } from "../dominio/recuperacion.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type { ErrorDeAsistencia, Fecha, RepositorioAsistencia } from "./puertos.ts";

const INEXISTENTE = falla("recuperacion-inexistente", "Esa recuperación no existe o ya se anuló.");

/** Los lugares libres de la fecha, leídos con la fecha ya tomada. */
export async function lugaresDe(
  repo: RepositorioAsistencia,
  fecha: Pick<Fecha, "id" | "claseId" | "empiezaEn" | "cupo">,
): Promise<number> {
  return lugaresLibres({ cupo: fecha.cupo, ...(await repo.cuentaDeLugares(fecha)) });
}

/** Con el crédito de esa sede que vence antes, si hay lugar y no está inscripto en la clase. */
export async function recuperar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, alumnoId }: { fechaId: string; alumnoId: string },
): Promise<Resultado<{ id: string }, ErrorDeAsistencia>> {
  const fecha = await fechaCon(repo, quien, RECUPERAR, fechaId);
  if (!fecha.ok) return fecha;
  const { claseId, empiezaEn, sedeId } = fecha.valor;
  const inscripto = await repo.estabanInscriptos({
    claseId,
    momento: empiezaEn,
    alumnoIds: [alumnoId],
  });
  if (inscripto.has(alumnoId)) {
    return falla("ya-inscripto", "Ese alumno ya está inscripto en esta clase.");
  }
  await repo.bloquearFecha(fechaId);
  if ((await repo.recuperanEntre(fechaId, [alumnoId])).has(alumnoId)) {
    return falla("ya-recupera", "Ese alumno ya recupera en esta fecha.");
  }
  const regla = puedeRecuperar(fecha.valor, ahora, await lugaresDe(repo, fecha.valor));
  if (!regla.ok) return regla;
  const credito = await repo.creditoParaUsar({ alumnoId, sedeId, empiezaEn, ahora });
  if (credito === undefined) {
    return falla("sin-creditos", "Ese alumno no tiene créditos para recuperar en esta sede.");
  }
  const id = await repo.recuperar(
    fecha.valor,
    { alumnoId, creditoId: credito.id },
    registroDe(quien, ahora),
  );
  if (id === undefined) return falla("ya-recupera", "Ese alumno ya recupera en esta fecha.");
  return ok({ id });
}

/** Anular libera el lugar y el crédito, que conserva su vencimiento. Solo antes del inicio. */
export async function anular(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { id }: { id: string },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  const reserva = await repo.recuperacion(id);
  if (reserva === undefined) return INEXISTENTE;
  const fecha = await fechaCon(repo, quien, RECUPERAR, reserva.ocurrenciaId);
  if (!fecha.ok) return fecha.error.codigo === "fecha-inexistente" ? INEXISTENTE : fecha;
  const regla = puedeRecuperar(fecha.valor, ahora, 1);
  if (!regla.ok) return regla;
  if (!(await repo.anularRecuperacion(id, ahora))) return INEXISTENTE;
  return ok(null);
}
