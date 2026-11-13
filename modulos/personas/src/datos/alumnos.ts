// Alumnos del centro (ver docs/decisiones/0011). Toda función corre dentro de enContexto: RLS
// limita al centro del contexto.
import { falla, ok, type Resultado } from "@app/nucleo";
import { conPuntoDeGuardado, type Transaccion } from "@app/plataforma";
import { and, asc, count, eq, inArray, sql, type SQL } from "drizzle-orm";
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
  numeroDeSocio: alumnos.numeroDeSocio,
  fechaDeInicio: alumnos.fechaDeInicio,
  activo: alumnos.activo,
  bajaEn: alumnos.bajaEn,
  pendienteDeCompletar: sql<boolean>`${alumnos.telefono} is null`,
  version: alumnos.version,
};

const REPETIDO = falla("documento-repetido", "Ya hay un alumno con ese documento en el centro.");
const SOCIO_REPETIDO = falla("socio-repetido", "Ya hay un alumno con ese número de socio.");
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

/** Una página de otro módulo, como mucho: más que eso es un error de quien llama (regla 8). */
const MAXIMO_POR_CONSULTA = 100;

/**
 * Los alumnos del centro con esos ids, en una sola consulta: para que otro módulo muestre una
 * página con sus alumnos sin pedirlos de a uno. Los ids que no son del centro no vuelven.
 */
export async function obtenerAlumnos(tx: Transaccion, ids: readonly string[]): Promise<Alumno[]> {
  if (ids.length > MAXIMO_POR_CONSULTA) {
    throw new Error(`obtenerAlumnos acepta hasta ${String(MAXIMO_POR_CONSULTA)} ids por consulta.`);
  }
  if (ids.length === 0) return [];
  return tx
    .select(columnas)
    .from(alumnos)
    .where(inArray(alumnos.id, [...ids]));
}

/** El índice único con el que chocó el error de Postgres (o el que envuelve Drizzle). */
function indiceDelChoque(error: unknown): string | undefined {
  const causa = error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (typeof causa !== "object" || causa === null || !("constraint" in causa)) return undefined;
  return typeof causa.constraint === "string" ? causa.constraint : undefined;
}

/**
 * Corre la escritura con un punto de guardado: si choca con el documento o el número de socio de
 * otro alumno (también si otro los carga a la vez), se deshace y se avisa.
 */
async function sinRepetir<T>(
  tx: Transaccion,
  escritura: () => Promise<T>,
): Promise<Resultado<T, ErrorDeAlumno>> {
  try {
    return await conPuntoDeGuardado(tx, async () => ok(await escritura()));
  } catch (error) {
    const indice = indiceDelChoque(error);
    if (indice === "alumnos_centro_documento") return REPETIDO;
    if (indice === "alumnos_centro_socio") return SOCIO_REPETIDO;
    throw error;
  }
}

/** El siguiente número de socio del centro. Las altas sin número van de a una (bloqueo). */
async function siguienteNumero(tx: Transaccion): Promise<number> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('socios:' || app_centro_actual()::text, 0))`,
  );
  const [fila] = await tx
    .select({ ultimo: sql<number>`coalesce(max(${alumnos.numeroDeSocio}), 0)`.mapWith(Number) })
    .from(alumnos);
  return (fila?.ultimo ?? 0) + 1;
}

export async function crearAlumno(
  tx: Transaccion,
  datos: DatosDeAlumno,
): Promise<Resultado<{ id: string }, ErrorDeAlumno>> {
  const ficha = limpiarFicha(datos);
  if (!ficha.ok) return ficha;
  const numeroDeSocio = ficha.valor.numeroDeSocio ?? (await siguienteNumero(tx));
  const guardado = await sinRepetir(tx, async () => {
    const [fila] = await tx
      .insert(alumnos)
      .values({
        ...ficha.valor,
        numeroDeSocio,
        busqueda: textoDeBusqueda(ficha.valor, numeroDeSocio),
        centroId: sql`app_centro_actual()`,
      })
      .returning({ id: alumnos.id });
    return fila;
  });
  if (!guardado.ok) return guardado;
  if (guardado.valor === undefined) throw new Error("El alta del alumno no devolvió su id.");
  return ok(guardado.valor);
}

/** Guarda la ficha si la versión coincide; lo que no vino (número, inicio) queda como estaba. */
async function guardarFicha(
  tx: Transaccion,
  { id, version, ficha }: { id: string; version: number; ficha: DatosDeAlumno },
): Promise<Resultado<{ version: number } | undefined, ErrorDeAlumno>> {
  const actual = await obtenerAlumno(tx, id);
  if (actual === undefined) return ok(undefined);
  const { numeroDeSocio, ...resto } = ficha;
  const numero = numeroDeSocio ?? actual.numeroDeSocio;
  return sinRepetir(tx, async () => {
    const [fila] = await tx
      .update(alumnos)
      .set({
        ...resto,
        numeroDeSocio: numero,
        busqueda: textoDeBusqueda(ficha, numero),
        version: sql`${alumnos.version} + 1`,
      })
      .where(and(eq(alumnos.id, id), eq(alumnos.version, version)))
      .returning({ version: alumnos.version });
    return fila;
  });
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

/**
 * Lo que tiene que pasar en la misma transacción cuando un alumno se da de baja: la API le pasa
 * `liberarLugares` de agenda (0019). Si falla, la baja tampoco queda.
 */
export type AlDarDeBaja = (
  tx: Transaccion,
  baja: { alumnoId: string; ahora: Date },
) => Promise<unknown>;

export async function fijarActivo(
  tx: Transaccion,
  { id, activo }: { id: string; activo: boolean },
  alDarDeBaja?: AlDarDeBaja,
): Promise<Resultado<null, ErrorDeAlumno>> {
  const ahora = new Date();
  const filas = await tx
    .update(alumnos)
    .set({ activo, bajaEn: activo ? null : ahora, version: sql`${alumnos.version} + 1` })
    .where(eq(alumnos.id, id))
    .returning({ id: alumnos.id });
  if (filas.length === 0) return INEXISTENTE;
  if (!activo && alDarDeBaja !== undefined) await alDarDeBaja(tx, { alumnoId: id, ahora });
  return ok(null);
}
