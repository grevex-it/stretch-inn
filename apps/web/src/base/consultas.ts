// Cliente de TanStack Query del panel. Si cualquier pedido responde que la sesión terminó, el
// panel vuelve al login sin que cada pantalla lo tenga que manejar.
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ErrorDeApi } from "./api.ts";

export const CLAVE_DE_SESION = ["sesion"] as const;

/** Sin sesión: se olvidan los datos del centro y la sesión queda en null (muestra el login). */
export function olvidarSesion(cliente: QueryClient): void {
  cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== CLAVE_DE_SESION[0] });
  cliente.setQueryData(CLAVE_DE_SESION, null);
}

export function crearClienteDeConsultas({ reintentar = true } = {}): QueryClient {
  const alFallar = (error: Error) => {
    if (error instanceof ErrorDeApi && error.estado === 401) olvidarSesion(cliente);
  };
  const cliente: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: alFallar }),
    mutationCache: new MutationCache({ onError: alFallar }),
    defaultOptions: {
      queries: {
        // Un 4xx no se arregla reintentando; un corte de red, a veces sí.
        retry: (intentos, error) =>
          reintentar && intentos < 2 && !(error instanceof ErrorDeApi && error.estado >= 400),
        refetchOnWindowFocus: true,
      },
    },
  });
  return cliente;
}
