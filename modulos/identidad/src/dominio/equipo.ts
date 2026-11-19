// Reglas para gestionar el equipo del centro: alta, reset de clave, bloqueo, y roles y ajustes de
// cada persona (0007 y 0017). Puras: sin base ni HTTP.
import { falla, ok, type Resultado, type SedeId } from "@app/nucleo";
import { tieneMenosPermisos, type PermisosPorSede } from "./permisos.ts";

export type ErrorDeGestion = "a-vos-mismo" | "mas-permisos";
export type ErrorDeCambioDePermisos = ErrorDeGestion | "sin-gestion-en-la-sede";
export type ErrorDeAlta = "nombre-vacio" | "sin-sedes";

export interface Integrante {
  usuarioId: string;
  permisos: PermisosPorSede;
}

/**
 * Resetear la clave o bloquear: solo a quien tiene menos permisos (0017). Como «acceso total» es
 * el máximo, esto también impide bloquear a alguien con acceso total.
 */
export function puedeGestionarA(
  quien: Integrante,
  objetivo: Integrante,
): Resultado<null, ErrorDeGestion> {
  if (quien.usuarioId === objetivo.usuarioId) {
    return falla("a-vos-mismo", "No podés hacer esto con tu propio usuario.");
  }
  if (!tieneMenosPermisos(objetivo.permisos, quien.permisos)) {
    return falla(
      "mas-permisos",
      "Solo podés hacerlo con alguien que tenga menos permisos que vos. Si hace falta, pedíselo al soporte.",
    );
  }
  return ok(null);
}

/**
 * Asignar o quitar un rol, o ajustar un permiso, a otro en una sede: con usuarios.gestionar en esa
 * sede, nunca a uno mismo, y solo a quien tiene menos permisos en todas sus sedes. Un dueño
 * (acceso total) puede con cualquier otro, también con otro dueño: entre ellos se cubren.
 * Que no dé lo que no tiene se controla aparte, con los permisos que da.
 */
export function puedeCambiarPermisosDe(
  quien: Integrante,
  objetivo: Integrante,
  { sedeId, esDueno }: { sedeId: SedeId; esDueno: boolean },
): Resultado<null, ErrorDeCambioDePermisos> {
  if (quien.permisos.get(sedeId)?.has("usuarios.gestionar") !== true) {
    return falla("sin-gestion-en-la-sede", "No gestionás usuarios en esa sede.");
  }
  if (quien.usuarioId === objetivo.usuarioId) {
    return falla("a-vos-mismo", "No podés cambiar tus propios permisos: pedíselo a un dueño.");
  }
  if (!esDueno && !tieneMenosPermisos(objetivo.permisos, quien.permisos)) {
    return falla(
      "mas-permisos",
      "Solo podés cambiarle los permisos a alguien con menos permisos que vos y solo en tus sedes.",
    );
  }
  return ok(null);
}

export function validarAlta(datos: {
  nombre: string;
  sedeIds: readonly string[];
}): Resultado<{ nombre: string; sedeIds: string[] }, ErrorDeAlta> {
  const nombre = datos.nombre.trim();
  if (nombre === "") return falla("nombre-vacio", "Escribí el nombre.");
  if (datos.sedeIds.length === 0) return falla("sin-sedes", "Elegí al menos una sede.");
  return ok({ nombre, sedeIds: [...new Set(datos.sedeIds)] });
}
