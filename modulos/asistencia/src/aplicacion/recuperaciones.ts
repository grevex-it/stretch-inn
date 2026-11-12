// Casos de uso de las recuperaciones. Todo lo que mueve los lugares de una fecha la toma antes
// (bloqueo por fecha, 0013): dos reservas por el último lugar no entran las dos.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { RECUPERAR } from "../dominio/permisos.ts";
import { lugaresLibres, puedeRecuperar } from "../dominio/recuperacion.ts";
import { aTiempo, REGLAS_POR_DEFECTO } from "../dominio/reglas.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type {
  ConsultaAbonoVigente,
  ErrorDeAsistencia,
  Fecha,
  RepositorioAsistencia,
} from "./puertos.ts";

const INEXISTENTE = falla("recuperacion-inexistente", "Esa recuperación no existe o ya se anuló.");

/** Los lugares libres de la fecha, leídos con la fecha ya tomada. */
export async function lugaresDe(
  repo: RepositorioAsistencia,
  fecha: Pick<Fecha, "id" | "claseId" | "empiezaEn" | "cupo">,
): Promise<number> {
  return lugaresLibres({ cupo: fecha.cupo, ...(await repo.cuentaDeLugares(fecha)) });
}

/**
 * Si las reglas de la sede dejan recuperar en esa fecha: con la anticipación de la sede, dentro
 * del abono vigente (o sin abono, si la sede lo permite) y sin pasar el máximo por abono (0020).
 */
async function segunLasReglas(
  repo: RepositorioAsistencia,
  abonoVigente: ConsultaAbonoVigente,
  ahora: Date,
  { fecha, alumnoId }: { fecha: Fecha; alumnoId: string },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  const { sedeId, empiezaEn } = fecha;
  const reglas = (await repo.reglas(sedeId)) ?? REGLAS_POR_DEFECTO;
  if (!aTiempo(empiezaEn, ahora, reglas.anticipacionMinutos)) {
    return falla(
      "fuera-de-tiempo",
      `En esta sede hay que anotarse con ${String(reglas.anticipacionMinutos)} minutos de anticipación.`,
    );
  }
  const abono = await abonoVigente({ alumnoId, sedeId, en: empiezaEn });
  if (abono === undefined) {
    return reglas.sinAbono
      ? ok(null)
      : falla("sin-abono", "Ese alumno no tiene un abono vigente para esa fecha.");
  }
  await repo.bloquearAlumno(alumnoId);
  const hechas = await repo.recuperacionesEntre({
    alumnoId,
    sedeId,
    desde: abono.inicio,
    hasta: abono.fin,
  });
  if (hechas >= reglas.maximoPorAbono) {
    return falla(
      "sin-recuperaciones",
      `Ese alumno ya usó las ${String(reglas.maximoPorAbono)} recuperaciones de su abono.`,
    );
  }
  return ok(null);
}

/** Si hay lugar, no está inscripto en la clase y las reglas de la sede lo dejan. */
export async function recuperar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, alumnoId }: { fechaId: string; alumnoId: string },
  abonoVigente: ConsultaAbonoVigente,
): Promise<Resultado<{ id: string }, ErrorDeAsistencia>> {
  const fecha = await fechaCon(repo, quien, RECUPERAR, fechaId);
  if (!fecha.ok) return fecha;
  const { claseId, empiezaEn } = fecha.valor;
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
  const permitida = await segunLasReglas(repo, abonoVigente, ahora, {
    fecha: fecha.valor,
    alumnoId,
  });
  if (!permitida.ok) return permitida;
  const id = await repo.recuperar(fecha.valor, { alumnoId }, registroDe(quien, ahora));
  if (id === undefined) return falla("ya-recupera", "Ese alumno ya recupera en esta fecha.");
  return ok({ id });
}

/** Anular libera el lugar. Solo antes del inicio. */
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
