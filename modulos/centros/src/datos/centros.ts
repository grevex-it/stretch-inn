// Centros y sedes. Toda función corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles del contexto (ver docs/decisiones/0002 y 0017).
import { falla, ok, type Resultado, type SedeId } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, sql } from "drizzle-orm";
import { centros, sedes } from "./esquema.ts";

export interface NuevaSede {
  id: string;
  nombre: string;
  esCentral?: boolean;
}

export interface NuevoCentro {
  /** Lo genera quien da el alta: el contexto de la transacción tiene que ser este centro. */
  id: string;
  nombre: string;
  zonaHoraria?: string;
  sedes: NuevaSede[];
}

export interface Centro {
  id: string;
  nombre: string;
  zonaHoraria: string;
  version: number;
}

export interface Sede {
  id: string;
  nombre: string;
  esCentral: boolean;
  version: number;
}

type ErrorAlta = "nombre-vacio" | "zona-horaria-invalida" | "sede-repetida" | "una-sola-central";

function zonaHorariaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** Valida antes de escribir; las restricciones de la base son la última barrera. */
function validarAlta(datos: NuevoCentro): Resultado<null, ErrorAlta> {
  const nombres = datos.sedes.map((sede) => sede.nombre.trim().toLocaleLowerCase("es-AR"));
  if (datos.nombre.trim() === "" || nombres.includes("")) {
    return falla("nombre-vacio", "El nombre no puede quedar vacío.");
  }
  if (datos.zonaHoraria !== undefined && !zonaHorariaValida(datos.zonaHoraria)) {
    return falla("zona-horaria-invalida", `La zona horaria "${datos.zonaHoraria}" no existe.`);
  }
  if (new Set(nombres).size !== nombres.length) {
    return falla("sede-repetida", "Hay dos sedes con el mismo nombre.");
  }
  if (datos.sedes.filter((sede) => sede.esCentral === true).length > 1) {
    return falla("una-sola-central", "Solo puede haber una sede central.");
  }
  return ok(null);
}

export async function crearCentro(
  tx: Transaccion,
  datos: NuevoCentro,
): Promise<Resultado<{ id: string }, ErrorAlta>> {
  const validacion = validarAlta(datos);
  if (!validacion.ok) return validacion;

  await tx.insert(centros).values({
    id: datos.id,
    nombre: datos.nombre.trim(),
    ...(datos.zonaHoraria === undefined ? {} : { zonaHoraria: datos.zonaHoraria }),
  });
  if (datos.sedes.length > 0) {
    await tx.insert(sedes).values(
      datos.sedes.map((sede) => ({
        id: sede.id,
        centroId: datos.id,
        nombre: sede.nombre.trim(),
        esCentral: sede.esCentral ?? false,
      })),
    );
  }
  return ok({ id: datos.id });
}

/** El centro del contexto. */
export async function obtenerCentro(tx: Transaccion): Promise<Centro | undefined> {
  const [centro] = await tx
    .select({
      id: centros.id,
      nombre: centros.nombre,
      zonaHoraria: centros.zonaHoraria,
      version: centros.version,
    })
    .from(centros);
  return centro;
}

/** Sedes visibles para el contexto, por nombre. Un centro tiene pocas sedes: no se pagina. */
export function listarSedes(tx: Transaccion): Promise<Sede[]> {
  return tx
    .select({
      id: sedes.id,
      nombre: sedes.nombre,
      esCentral: sedes.esCentral,
      version: sedes.version,
    })
    .from(sedes)
    .orderBy(asc(sedes.nombre));
}

export interface CambioDeNombre {
  sedeId: SedeId;
  nombre: string;
  /** La versión que vio quien edita (0013). */
  version: number;
}

export async function renombrarSede(
  tx: Transaccion,
  { sedeId, nombre, version }: CambioDeNombre,
): Promise<Resultado<{ version: number }, "nombre-vacio" | "cambio-concurrente">> {
  if (nombre.trim() === "") return falla("nombre-vacio", "El nombre no puede quedar vacío.");
  const actualizadas = await tx
    .update(sedes)
    .set({ nombre: nombre.trim(), version: sql`${sedes.version} + 1` })
    .where(and(eq(sedes.id, sedeId), eq(sedes.version, version)))
    .returning({ version: sedes.version });
  const [fila] = actualizadas;
  if (fila === undefined) {
    return falla("cambio-concurrente", "Esto cambió mientras lo editabas. Volvé a cargarlo.");
  }
  return ok(fila);
}
