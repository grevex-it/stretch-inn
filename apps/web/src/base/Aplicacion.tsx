// El panel entero: consultas, puerta de la sesión y ruteo.
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { useState } from "react";
import { Puerta } from "./Puerta.tsx";
import { crearRouter } from "./rutas.tsx";

interface Props {
  clienteDeConsultas: QueryClient;
  historial?: RouterHistory;
}

export function Aplicacion({ clienteDeConsultas, historial }: Props) {
  const [router] = useState(() => crearRouter(historial));
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <Puerta>
        <RouterProvider router={router} />
      </Puerta>
    </QueryClientProvider>
  );
}
