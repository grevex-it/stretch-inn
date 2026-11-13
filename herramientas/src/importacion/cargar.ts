// Cargar las filas de la planilla por la API del sistema (0022), de a una: la API valida cada
// ficha con las mismas reglas que el panel. Repetir la carga no duplica: el número de socio que ya
// está se saltea.
import type { FilaDeLaPlanilla, Problema } from "./planilla.ts";

/** Lo que va en POST /alumnos (fichaDeAlumno de @app/contratos). */
interface FichaACargar {
  nombre: string;
  apellido: string;
  telefono: string | null;
  documento: string | null;
  email: null;
  fechaNacimiento: string | null;
  notas: string;
  numeroDeSocio: number;
  fechaDeInicio: string | null;
  profeId: string | null;
}

/** Lo que el importador necesita de la API, ya con la sesión del usuario que carga. */
export interface ApiDeCarga {
  /** Los integrantes del equipo: nombre normalizado → id. */
  profes(): Promise<Map<string, string>>;
  existe(numeroDeSocio: number): Promise<boolean>;
  crear(ficha: FichaACargar): Promise<{ ok: true; id: string } | { ok: false; mensaje: string }>;
  guardarSalud(id: string, patologias: string): Promise<void>;
  darDeBaja(id: string): Promise<void>;
}

export interface InformeDeCarga {
  creados: number;
  yaEstaban: number;
  errores: Problema[];
  /** Los profes de la planilla que no tienen usuario en el equipo: esos alumnos quedan sin profe. */
  profesSinUsuario: string[];
}

/** Minúsculas, sin tildes y con un solo espacio: «LORENA  SOSA» y «Lorena Sosa» son iguales. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function fichaDe(fila: FilaDeLaPlanilla, profeId: string | null): FichaACargar {
  return {
    nombre: fila.nombre,
    apellido: fila.apellido,
    telefono: fila.telefono,
    documento: fila.documento,
    email: null,
    fechaNacimiento: fila.fechaNacimiento,
    notas: "",
    numeroDeSocio: fila.numeroDeSocio,
    fechaDeInicio: fila.fechaDeInicio,
    profeId,
  };
}

/** Una fila: la crea, le carga la salud y, si está inactiva, la da de baja. */
async function cargarFila(
  fila: FilaDeLaPlanilla,
  profeId: string | null,
  api: ApiDeCarga,
): Promise<"creado" | "ya-estaba" | Problema> {
  if (await api.existe(fila.numeroDeSocio)) return "ya-estaba";
  const creado = await api.crear(fichaDe(fila, profeId));
  if (!creado.ok) return { fila: fila.fila, mensaje: creado.mensaje };
  if (fila.salud !== null) await api.guardarSalud(creado.id, fila.salud);
  if (!fila.activo) await api.darDeBaja(creado.id);
  return "creado";
}

/** De a una y en orden: son pocos cientos y así el informe sigue la planilla. */
export async function cargarFilas(
  filas: readonly FilaDeLaPlanilla[],
  api: ApiDeCarga,
): Promise<InformeDeCarga> {
  const profes = await api.profes();
  const informe: InformeDeCarga = { creados: 0, yaEstaban: 0, errores: [], profesSinUsuario: [] };
  for (const fila of filas) {
    const profeId = fila.profe === null ? null : (profes.get(normalizarNombre(fila.profe)) ?? null);
    if (fila.profe !== null && profeId === null && !informe.profesSinUsuario.includes(fila.profe)) {
      informe.profesSinUsuario.push(fila.profe);
    }
    const resultado = await cargarFila(fila, profeId, api);
    if (resultado === "creado") informe.creados++;
    else if (resultado === "ya-estaba") informe.yaEstaban++;
    else informe.errores.push(resultado);
  }
  return informe;
}
