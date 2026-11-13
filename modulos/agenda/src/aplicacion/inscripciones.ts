// Casos de uso de las inscripciones fijas. El cupo se protege con la clase bloqueada (`for
// update`) y con la restricción clases_inscriptos de la base, la última barrera (0013).
import { falla, ok, sedesVisibles, type ContextoCentro, type Resultado } from "@app/nucleo";
import { entraEnLasFechas, puedeInscribirse } from "../dominio/inscripcion.ts";
import { INSCRIBIR, VER } from "../dominio/permisos.ts";
import { puedeEn, SIN_PERMISO } from "./clases.ts";
import type {
  ErrorDeAgenda,
  InscripcionDeAlumno,
  Inscripto,
  Pagina,
  PaginaDe,
  RepositorioAgenda,
  RepositorioInscripciones,
} from "./puertos.ts";

export interface Repositorios {
  agenda: RepositorioAgenda;
  inscripciones: RepositorioInscripciones;
}

const INEXISTENTE = falla("inscripcion-inexistente", "Esa inscripción no existe o ya es baja.");

/**
 * Toma la clase (si dos van por el último lugar, el segundo espera al primero y ve la clase
 * completa), controla las reglas y ocupa el lugar en la misma transacción.
 */
export async function inscribir(
  repos: Repositorios,
  quien: ContextoCentro,
  ahora: Date,
  { claseId, alumnoId }: { claseId: string; alumnoId: string },
): Promise<Resultado<{ id: string }, ErrorDeAgenda>> {
  const clase = await repos.agenda.clase(claseId, true);
  if (clase === undefined) return falla("clase-inexistente", "Esa clase no existe.");
  if (!puedeEn(quien, INSCRIBIR, clase.sedeId)) return SIN_PERMISO;
  const regla = puedeInscribirse(clase, await repos.inscripciones.alumno(alumnoId));
  if (!regla.ok) return regla;
  const masOcupada = await repos.agenda.masOcupadaFutura(claseId, ahora);
  const enLasFechas = entraEnLasFechas(clase.cupo, clase.inscriptos + 1, masOcupada);
  if (!enLasFechas.ok) return enLasFechas;
  const id = await repos.inscripciones.inscribir({ claseId, sedeId: clase.sedeId, alumnoId });
  if (id === undefined) return falla("ya-inscripto", "Ese alumno ya está inscripto en esta clase.");
  await repos.inscripciones.sumarInscriptos(claseId, 1);
  return ok({ id });
}

/** La baja no borra la inscripción: la marca y libera el lugar. */
export async function darDeBaja(
  repos: Repositorios,
  quien: ContextoCentro,
  ahora: Date,
  { id }: { id: string },
): Promise<Resultado<null, ErrorDeAgenda>> {
  const inscripcion = await repos.inscripciones.vigente(id);
  if (inscripcion === undefined) return INEXISTENTE;
  const clase = await repos.agenda.clase(inscripcion.claseId, true);
  if (clase === undefined) return INEXISTENTE;
  if (!puedeEn(quien, INSCRIBIR, clase.sedeId)) return SIN_PERMISO;
  if (!(await repos.inscripciones.darDeBaja(id, ahora))) return INEXISTENTE;
  await repos.inscripciones.sumarInscriptos(inscripcion.claseId, -1);
  return ok(null);
}

/** Una página de inscripciones y sus alumnos en dos consultas, sin N+1 (regla 8). */
export async function deClase(
  repos: Repositorios,
  quien: ContextoCentro,
  { claseId, ...pagina }: Pagina & { claseId: string },
): Promise<Resultado<PaginaDe<Inscripto>, ErrorDeAgenda>> {
  const clase = await repos.agenda.clase(claseId);
  if (clase === undefined) return falla("clase-inexistente", "Esa clase no existe.");
  if (!puedeEn(quien, VER, clase.sedeId)) return SIN_PERMISO;
  const inscripciones = await repos.inscripciones.deClase({ ...pagina, claseId });
  const alumnos = await repos.inscripciones.alumnos(inscripciones.elementos.map((i) => i.alumnoId));
  return ok({
    ...inscripciones,
    elementos: inscripciones.elementos.flatMap((inscripcion) => {
      const alumno = alumnos.get(inscripcion.alumnoId);
      return alumno === undefined ? [] : [{ ...inscripcion, ...alumno }];
    }),
  });
}

export async function deAlumno(
  repos: Repositorios,
  quien: ContextoCentro,
  filtro: Pagina & { alumnoId: string },
): Promise<Resultado<PaginaDe<InscripcionDeAlumno>, ErrorDeAgenda>> {
  const sedeIds = sedesVisibles(quien).filter((sede) => puedeEn(quien, VER, sede));
  return ok(await repos.inscripciones.deAlumno({ ...filtro, sedeIds }));
}
