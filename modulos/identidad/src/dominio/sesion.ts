// Reglas de la sesión (ver docs/decisiones/0017): vencimiento, clave nueva y sede activa.
import { falla, ok, type Resultado, type SedeId } from "@app/nucleo";
import type { PermisosPorSede } from "./permisos.ts";

const HORA = 60 * 60 * 1000;
/** Plazos iniciales de la 0017; se ajustan con el uso. */
const SIN_USO_MAXIMO_MS = 12 * HORA;
const DURACION_MAXIMA_MS = 7 * 24 * HORA;
const LARGO_MINIMO_DE_CLAVE = 10;

/** Una sede puntual o «Todas mis sedes». */
export type SedeActiva = SedeId | "todas";

/** Vence a las 12 horas sin uso, y siempre a los 7 días. */
export function sesionVigente(
  { creadaEn, ultimoUsoEn }: { creadaEn: Date; ultimoUsoEn: Date },
  ahora: Date,
): boolean {
  return (
    ahora.getTime() - ultimoUsoEn.getTime() < SIN_USO_MAXIMO_MS &&
    ahora.getTime() - creadaEn.getTime() < DURACION_MAXIMA_MS
  );
}

/** Mínimo 10 caracteres, sin reglas de composición. Cuenta caracteres, no bytes. */
export function validarClaveNueva(clave: string): Resultado<null, "clave-corta"> {
  if (Array.from(clave).length < LARGO_MINIMO_DE_CLAVE) {
    return falla(
      "clave-corta",
      `La contraseña tiene que tener al menos ${String(LARGO_MINIMO_DE_CLAVE)} caracteres.`,
    );
  }
  return ok(null);
}

/** Sedes donde tiene algún permiso: las que puede elegir. */
export function sedesConPermisos(permisos: PermisosPorSede): SedeId[] {
  return [...permisos].filter(([, lista]) => lista.size > 0).map(([sede]) => sede);
}

/**
 * La sede con la que trabaja el usuario, a partir de la que eligió antes (o null la primera vez).
 * Con una sola sede, esa; si perdió los permisos en la elegida, otra, y `cambiada` lo avisa.
 */
export function elegirSedeActiva(
  preferida: SedeActiva | null,
  permisos: PermisosPorSede,
): Resultado<{ sede: SedeActiva; cambiada: boolean }, "sin-permisos"> {
  const sedes = sedesConPermisos(permisos);
  const [unica] = sedes;
  if (unica === undefined) {
    return falla("sin-permisos", "No tenés permisos en ninguna sede de este centro.");
  }
  const perdida = preferida !== null && preferida !== "todas" && !sedes.includes(preferida);
  if (sedes.length === 1) return ok({ sede: unica, cambiada: perdida });
  if (preferida === null || preferida === "todas" || perdida) {
    return ok({ sede: "todas", cambiada: perdida });
  }
  return ok({ sede: preferida, cambiada: false });
}

/** Con una sede elegida, el contexto lleva solo esa sede: RLS no le muestra las demás. */
export function permisosDeLaSedeActiva(
  permisos: PermisosPorSede,
  sede: SedeActiva,
): PermisosPorSede {
  if (sede === "todas") return permisos;
  const deLaSede = permisos.get(sede);
  return new Map(deLaSede === undefined ? [] : [[sede, deLaSede]]);
}
