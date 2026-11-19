// Roles a medida, catálogo y permisos de cada persona (ver docs/decisiones/0007). Todo pasa por la
// API con TanStack Query; cualquier cambio vuelve a pedir lo del equipo.
import {
  catalogoDePermisos,
  fichaDeRol,
  paginaDeRoles,
  permisosDeIntegrante,
  rolCreado,
  rolEditado,
  type PedidoDeAjuste,
  type PedidoDeAsignacion,
} from "@app/contratos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultar, enviar, enviarYLeer } from "../../base/api.ts";
import { EQUIPO } from "./consultas.ts";

export function useCatalogo() {
  return useQuery({
    queryKey: [...EQUIPO, "catalogo"],
    queryFn: () => consultar("/equipo/catalogo", catalogoDePermisos),
    staleTime: Infinity,
  });
}

export function useListaDeRoles(pagina: number) {
  return useQuery({
    queryKey: [...EQUIPO, "roles", pagina],
    queryFn: () => consultar(`/equipo/roles?pagina=${String(pagina)}`, paginaDeRoles),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaDeRol(rolId: string | undefined) {
  return useQuery({
    queryKey: [...EQUIPO, "rol", rolId],
    queryFn: () => consultar(`/equipo/roles/${rolId ?? ""}`, fichaDeRol),
    enabled: rolId !== undefined,
  });
}

export function usePermisosDe(usuarioId: string) {
  return useQuery({
    queryKey: [...EQUIPO, usuarioId, "permisos"],
    queryFn: () => consultar(`/equipo/${usuarioId}/permisos`, permisosDeIntegrante),
  });
}

function useCambio<Datos>(cambiar: (datos: Datos) => Promise<unknown>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: cambiar,
    onSuccess: () => cliente.invalidateQueries({ queryKey: EQUIPO }),
  });
}

/** Sin id crea el rol; con id y versión, lo edita (409 si alguien lo cambió mientras tanto). */
export interface RolAGuardar {
  id?: string;
  version?: number;
  nombre: string;
  permisos: string[];
}

export const useGuardarRol = () =>
  useCambio(({ id, version, ...rol }: RolAGuardar) =>
    id === undefined || version === undefined
      ? enviarYLeer("POST", "/equipo/roles", rolCreado, rol)
      : enviarYLeer("PUT", `/equipo/roles/${id}`, rolEditado, { ...rol, version }),
  );

export const useBorrarRol = () =>
  useCambio((rolId: string) => enviar("DELETE", `/equipo/roles/${rolId}`));

export const useAsignar = (usuarioId: string) =>
  useCambio((asignacion: PedidoDeAsignacion) =>
    enviar("POST", `/equipo/${usuarioId}/asignaciones`, asignacion),
  );

export const useQuitarAsignacion = (usuarioId: string) =>
  useCambio(({ sedeId, rolId }: PedidoDeAsignacion) =>
    enviar("DELETE", `/equipo/${usuarioId}/asignaciones/${sedeId}/${rolId}`),
  );

export const useAjustar = (usuarioId: string) =>
  useCambio((ajuste: PedidoDeAjuste) => enviar("PUT", `/equipo/${usuarioId}/ajustes`, ajuste));

export const useQuitarAjuste = (usuarioId: string) =>
  useCambio(({ sedeId, permiso }: Omit<PedidoDeAjuste, "tipo">) =>
    enviar("DELETE", `/equipo/${usuarioId}/ajustes/${sedeId}/${permiso}`),
  );
