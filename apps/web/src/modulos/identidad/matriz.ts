// Los atajos de cada sección del catálogo (0007): sin acceso, ver (sus permisos .ver), operar
// (todos) o personalizado (los que se marquen uno por uno).
export type Nivel = "sin-acceso" | "ver" | "operar" | "personalizado";

export const NIVELES: { nivel: Nivel; texto: string }[] = [
  { nivel: "sin-acceso", texto: "Sin acceso" },
  { nivel: "ver", texto: "Ver" },
  { nivel: "operar", texto: "Operar" },
  { nivel: "personalizado", texto: "Personalizado" },
];

const deVer = (permisos: readonly string[]) => permisos.filter((p) => p.endsWith(".ver"));

/** El atajo que corresponde a lo marcado en una sección. */
export function nivelDe(permisos: readonly string[], elegidos: ReadonlySet<string>): Nivel {
  const marcados = permisos.filter((p) => elegidos.has(p));
  if (marcados.length === 0) return "sin-acceso";
  if (marcados.length === permisos.length) return "operar";
  const ver = deVer(permisos);
  if (marcados.length === ver.length && ver.every((p) => elegidos.has(p))) return "ver";
  return "personalizado";
}

/** Lo elegido con el atajo aplicado a esa sección. «Personalizado» no cambia nada. */
export function conNivel(
  permisos: readonly string[],
  elegidos: ReadonlySet<string>,
  nivel: Nivel,
): Set<string> {
  if (nivel === "personalizado") return new Set(elegidos);
  const resultado = new Set([...elegidos].filter((p) => !permisos.includes(p)));
  const suma = nivel === "operar" ? permisos : nivel === "ver" ? deVer(permisos) : [];
  for (const p of suma) resultado.add(p);
  return resultado;
}

/** Lo elegido en el orden del catálogo, para mandarlo siempre igual. */
export function enOrden(
  secciones: readonly { permisos: readonly { permiso: string }[] }[],
  elegidos: ReadonlySet<string>,
): string[] {
  return secciones.flatMap((s) => s.permisos.map((p) => p.permiso)).filter((p) => elegidos.has(p));
}
