// Datos del equipo del centro (ver docs/decisiones/0017). Todo pasa por la API con TanStack Query.
import {
  altaHecha,
  claveGenerada,
  paginaDeEquipo,
  paginaDeRoles,
  type PedidoDeAlta,
} from "@app/contratos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultar, enviar, enviarYLeer } from "../../base/api.ts";

const EQUIPO = ["equipo"] as const;

export function useEquipo(pagina: number) {
  return useQuery({
    queryKey: [...EQUIPO, pagina],
    queryFn: () => consultar(`/equipo?pagina=${String(pagina)}`, paginaDeEquipo),
    placeholderData: (anterior) => anterior,
  });
}

/** Los roles para dar en un alta. Una página alcanza mientras un centro no tenga más de 50. */
export function useRoles() {
  return useQuery({
    queryKey: [...EQUIPO, "roles"],
    queryFn: () => consultar("/equipo/roles?pagina=1", paginaDeRoles),
  });
}

/** Después de cualquier cambio se vuelve a pedir la lista. */
function useCambioDelEquipo<Datos, Resultado>(cambiar: (datos: Datos) => Promise<Resultado>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: cambiar,
    onSuccess: () => cliente.invalidateQueries({ queryKey: EQUIPO }),
  });
}

export const useDarDeAlta = () =>
  useCambioDelEquipo((datos: PedidoDeAlta) => enviarYLeer("POST", "/equipo", altaHecha, datos));

export const useNuevaClave = () =>
  useCambioDelEquipo((usuarioId: string) =>
    enviarYLeer("POST", `/equipo/${usuarioId}/clave`, claveGenerada),
  );

export const useBloquear = () =>
  useCambioDelEquipo((usuarioId: string) => enviar("PUT", `/equipo/${usuarioId}/bloqueo`));

export const useReactivar = () =>
  useCambioDelEquipo((usuarioId: string) => enviar("DELETE", `/equipo/${usuarioId}/bloqueo`));
