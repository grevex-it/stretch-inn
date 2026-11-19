// Los cambios a los roles y ajustes de una persona, juntos: un solo error y un solo «ocupado» para
// toda la ficha de permisos.
import { mensajeDe } from "../../base/controles/Aviso.tsx";
import { useAjustar, useAsignar, useQuitarAjuste, useQuitarAsignacion } from "./consultas-roles.ts";

export function useCambiosDePermisos(usuarioId: string) {
  const asignar = useAsignar(usuarioId);
  const quitarAsignacion = useQuitarAsignacion(usuarioId);
  const ajustar = useAjustar(usuarioId);
  const quitarAjuste = useQuitarAjuste(usuarioId);
  const todos = [asignar, quitarAsignacion, ajustar, quitarAjuste];
  const ultimo = todos
    .filter((cambio) => cambio.submittedAt > 0)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];
  return {
    asignar: asignar.mutate,
    quitarAsignacion: quitarAsignacion.mutate,
    ajustar: ajustar.mutate,
    quitarAjuste: quitarAjuste.mutate,
    ocupado: todos.some((cambio) => cambio.isPending),
    /** El error del último cambio, si falló. */
    error: mensajeDe(ultimo?.error ?? null),
  };
}

export type CambiosDePermisos = ReturnType<typeof useCambiosDePermisos>;
