// Casos de uso de los avisos de ausencia. El permiso se controla en la sede de la fecha (0007).
// Todo aviso genera un crédito para recuperar en la misma transacción, que vence con el abono
// del alumno (0019, ver credito.ts).
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { puedeAvisar } from "../dominio/aviso.ts";
import { venceEl } from "../dominio/credito.ts";
import { AVISAR } from "../dominio/permisos.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type { ConsultaFinDelAbono, ErrorDeAsistencia, RepositorioAsistencia } from "./puertos.ts";

const INEXISTENTE = falla("aviso-inexistente", "Ese aviso no existe o ya se anuló.");

/** Solo quien estaba inscripto, antes del inicio y en una fecha no cancelada. */
export async function avisar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, alumnoId }: { fechaId: string; alumnoId: string },
  finDelAbono: ConsultaFinDelAbono,
): Promise<Resultado<{ id: string; conCredito: boolean }, ErrorDeAsistencia>> {
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
  const { sedeId } = fecha.valor;
  const fin = await finDelAbono({ alumnoId, sedeId, en: empiezaEn });
  await repo.crearCredito({
    avisoId: id,
    alumnoId,
    sedeId,
    ocurrenciaId: fechaId,
    venceEn: venceEl(empiezaEn, fin),
  });
  return ok({ id, conCredito: true });
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
  if (!(await repo.anularAviso(id, ahora))) return INEXISTENTE;
  await repo.anularCreditoDeAviso(id, ahora);
  return ok(null);
}
