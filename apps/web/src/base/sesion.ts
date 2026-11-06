// Estado de la sesión y lo que se puede hacer con ella (ver docs/decisiones/0017).
import {
  estadoDeSesion,
  type EstadoDeSesion,
  type PedidoDeCambioDeClave,
  type PedidoDeIngreso,
} from "@app/contratos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultar, enviar, ErrorDeApi } from "./api.ts";
import { CLAVE_DE_SESION, olvidarSesion } from "./consultas.ts";

/** El estado de la sesión, o null si no hay sesión (hay que entrar). */
export function useSesion() {
  return useQuery({
    queryKey: CLAVE_DE_SESION,
    queryFn: async (): Promise<EstadoDeSesion | null> => {
      try {
        return await consultar("/sesion", estadoDeSesion);
      } catch (error) {
        if (error instanceof ErrorDeApi && error.estado === 401) return null;
        throw error;
      }
    },
  });
}

/**
 * Si tiene el permiso en alguna sede del centro activo. Solo para mostrar u ocultar: la seguridad
 * la aplica la API en cada pedido.
 */
export function usePermiso(permiso: string): boolean {
  const { data: sesion } = useSesion();
  return sesion?.centroActivo?.permisos.includes(permiso) ?? false;
}

/** Cambiar algo de la sesión cambia qué datos se ven: se vuelve a pedir todo. */
function useCambioDeSesion<Datos>(cambiar: (datos: Datos) => Promise<void>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: cambiar,
    onSuccess: () => cliente.invalidateQueries(),
  });
}

export const useEntrar = () =>
  useCambioDeSesion((datos: PedidoDeIngreso) => enviar("POST", "/sesion", datos));

export const useCambiarClave = () =>
  useCambioDeSesion((datos: PedidoDeCambioDeClave) => enviar("PUT", "/sesion/clave", datos));

export const useElegirCentro = () =>
  useCambioDeSesion((centroId: string) => enviar("PUT", "/sesion/centro", { centroId }));

export const useElegirSede = () =>
  useCambioDeSesion((sede: string) => enviar("PUT", "/sesion/sede", { sede }));

export function useSalir() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => enviar("DELETE", "/sesion"),
    onSuccess: () => {
      olvidarSesion(cliente);
    },
  });
}
