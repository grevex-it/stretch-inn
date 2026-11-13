// Los datos de salud del alumno (patologías), aparte de su ficha y con permisos propios (0019).
// Corre con la Transaccion de enContexto: RLS limita al centro. Nunca van a un log (Ley 25.326).
import { falla, ok, type Resultado } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, eq, sql } from "drizzle-orm";
import { obtenerAlumno } from "./alumnos.ts";
import { saludDeAlumnos } from "./esquema.ts";
import type { ErrorDeAlumno } from "./tipos.ts";

const MAXIMO = 4000;
const INEXISTENTE = falla("alumno-inexistente", "Ese alumno no existe en el centro.");
const CONCURRENTE = falla(
  "cambio-concurrente",
  "Alguien cambió estos datos mientras los editabas. Volvé a cargarlos.",
);

/** Sin cargar, vacíos y con versión 0. */
export async function obtenerSalud(
  tx: Transaccion,
  alumnoId: string,
): Promise<Resultado<{ patologias: string; version: number }, ErrorDeAlumno>> {
  if ((await obtenerAlumno(tx, alumnoId)) === undefined) return INEXISTENTE;
  const [fila] = await tx
    .select({ patologias: saludDeAlumnos.patologias, version: saludDeAlumnos.version })
    .from(saludDeAlumnos)
    .where(eq(saludDeAlumnos.alumnoId, alumnoId));
  return ok(fila ?? { patologias: "", version: 0 });
}

/** Compara la versión que vio quien edita (0013): la primera vez, 0. */
export async function fijarSalud(
  tx: Transaccion,
  { alumnoId, patologias, version }: { alumnoId: string; patologias: string; version: number },
): Promise<Resultado<{ version: number }, ErrorDeAlumno>> {
  const texto = patologias.trim();
  if (texto.length > MAXIMO) {
    return falla("salud-muy-larga", "Las patologías son muy largas: hasta 4000 caracteres.");
  }
  if ((await obtenerAlumno(tx, alumnoId)) === undefined) return INEXISTENTE;
  const filas =
    version === 0
      ? await tx
          .insert(saludDeAlumnos)
          .values({ alumnoId, patologias: texto, centroId: sql`app_centro_actual()` })
          .onConflictDoNothing()
          .returning({ version: saludDeAlumnos.version })
      : await tx
          .update(saludDeAlumnos)
          .set({ patologias: texto, version: sql`${saludDeAlumnos.version} + 1` })
          .where(and(eq(saludDeAlumnos.alumnoId, alumnoId), eq(saludDeAlumnos.version, version)))
          .returning({ version: saludDeAlumnos.version });
  const [fila] = filas;
  return fila === undefined ? CONCURRENTE : ok({ version: fila.version });
}
