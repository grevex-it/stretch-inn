// Alumnos del centro (ver docs/decisiones/0011). Toda función corre dentro de enContexto: RLS
// limita al centro del contexto.
import { falla, ok, type Resultado } from "@app/nucleo";
import { conPuntoDeGuardado, type Transaccion } from "@app/plataforma";
import { and, asc, count, eq, sql, type SQL } from "drizzle-orm";
import { alumnos } from "./esquema.ts";
import { limpiarFicha, terminosDeBusqueda, textoDeBusqueda } from "./ficha.ts";
import type {
  Alumno,
  BusquedaDeAlumnos,
  DatosDeAlumno,
  ErrorDeAlumno,
  PaginaDeAlumnos,
} from "./tipos.ts";

const columnas = {
  id: alumnos.id,
  nombre: alumnos.nombre,
  apellido: alumnos.apellido,
  telefono: alumnos.telefono,
  documento: alumnos.documento,
  email: alumnos.email,
  fechaNacimiento: alumnos.fechaNacimiento,
  notas: alumnos.notas,
  activo: alumnos.activo,
  version: alumnos.version,
};

const REPETIDO = falla("documento-repetido", "Ya hay un alumno con ese documento en el centro.");
const INEXISTENTE = falla("alumno-inexistente", "Ese alumno no existe en el centro.");

function filtro({ buscar, conBajas }: BusquedaDeAlumnos): SQL | undefined {
  const condiciones = terminosDeBusqueda(buscar ?? "").map(
    (termino) => sql`${alumnos.busqueda} like ${`%${termino}%`} escape '\\'`,
  );
  if (conBajas !== true) condiciones.push(eq(alumnos.activo, true));
  return and(...condiciones);
}

export async function listarAlumnos(
  tx: Transaccion,
  busqueda: BusquedaDeAlumnos,
): Promise<PaginaDeAlumnos> {
  const { pagina, porPagina } = busqueda;
  const donde = filtro(busqueda);
  const [elementos, [total]] = await Promise.all([
    tx
      .select(columnas)
      .from(alumnos)
      .where(donde)
      .orderBy(asc(alumnos.apellido), asc(alumnos.nombre), asc(alumnos.id))
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
    tx.select({ total: count() }).from(alumnos).where(donde),
  ]);
  return { pagina, porPagina, total: total?.total ?? 0, elementos };
}

export async function obtenerAlumno(tx: Transaccion, id: string): Promise<Alumno | undefined> {
  const [alumno] = await tx.select(columnas).from(alumnos).where(eq(alumnos.id, id));
  return alumno;
}

export async function crearAlumno(
  tx: Transaccion,
  datos: DatosDeAlumno,
): Promise<Resultado<{ id: string }, ErrorDeAlumno>> {
  const ficha = limpiarFicha(datos);
  if (!ficha.ok) return ficha;
  // El índice único del documento es la barrera: si choca, no se inserta y no hay fila.
  const [fila] = await tx
    .insert(alumnos)
    .values({
      ...ficha.valor,
      busqueda: textoDeBusqueda(ficha.valor),
      centroId: sql`app_centro_actual()`,
    })
    .onConflictDoNothing()
    .returning({ id: alumnos.id });
  return fila === undefined ? REPETIDO : ok(fila);
}

/** El error de Postgres (o el que envuelve Drizzle) es el choque con el índice del documento. */
function chocaConElDocumento(error: unknown): boolean {
  const causa = error instanceof Error && error.cause !== undefined ? error.cause : error;
  return (
    typeof causa === "object" &&
    causa !== null &&
    "constraint" in causa &&
    causa.constraint === "alumnos_centro_documento"
  );
}

/**
 * Guarda la ficha si la versión coincide. El índice único del documento es la barrera, también
 * si otro lo carga a la vez: el choque se deshace con un punto de guardado y se avisa.
 */
async function guardarFicha(
  tx: Transaccion,
  { id, version, ficha }: { id: string; version: number; ficha: DatosDeAlumno },
): Promise<Resultado<{ version: number } | undefined, ErrorDeAlumno>> {
  try {
    return await conPuntoDeGuardado(tx, async () => {
      const [fila] = await tx
        .update(alumnos)
        .set({ ...ficha, busqueda: textoDeBusqueda(ficha), version: sql`${alumnos.version} + 1` })
        .where(and(eq(alumnos.id, id), eq(alumnos.version, version)))
        .returning({ version: alumnos.version });
      return ok(fila);
    });
  } catch (error) {
    if (chocaConElDocumento(error)) return REPETIDO;
    throw error;
  }
}

/** Compara la versión que vio quien edita (0013): si cambió en el medio, no pisa nada. */
export async function editarAlumno(
  tx: Transaccion,
  { id, version, ...datos }: DatosDeAlumno & { id: string; version: number },
): Promise<Resultado<{ version: number }, ErrorDeAlumno>> {
  const ficha = limpiarFicha(datos);
  if (!ficha.ok) return ficha;
  const guardado = await guardarFicha(tx, { id, version, ficha: ficha.valor });
  if (!guardado.ok) return guardado;
  const fila = guardado.valor;
  if (fila !== undefined) return ok(fila);
  return (await obtenerAlumno(tx, id)) === undefined
    ? INEXISTENTE
    : falla("cambio-concurrente", "Esta ficha cambió mientras la editabas. Volvé a cargarla.");
}

export async function fijarActivo(
  tx: Transaccion,
  { id, activo }: { id: string; activo: boolean },
): Promise<Resultado<null, ErrorDeAlumno>> {
  const filas = await tx
    .update(alumnos)
    .set({ activo, version: sql`${alumnos.version} + 1` })
    .where(eq(alumnos.id, id))
    .returning({ id: alumnos.id });
  return filas.length === 0 ? INEXISTENTE : ok(null);
}
