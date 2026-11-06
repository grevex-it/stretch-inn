// Un fetch falso para los tests del panel: responde según "MÉTODO /ruta" y anota los pedidos.
import { vi } from "vitest";

export interface Respuesta {
  estado: number;
  cuerpo?: unknown;
}

type Manejador = (cuerpo: unknown) => Respuesta;

export function servidorFalso(rutas: Record<string, Manejador | Respuesta>) {
  const pedidos: { clave: string; cuerpo: unknown; init: RequestInit | undefined }[] = [];
  const fetchFalso = vi.fn((url: string, init?: RequestInit) => {
    const clave = `${init?.method ?? "GET"} ${url}`;
    const cuerpo: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    pedidos.push({ clave, cuerpo, init });
    const ruta = rutas[clave];
    const respuesta =
      ruta === undefined ? { estado: 404 } : typeof ruta === "function" ? ruta(cuerpo) : ruta;
    const texto = respuesta.cuerpo === undefined ? null : JSON.stringify(respuesta.cuerpo);
    return Promise.resolve(new Response(texto, { status: respuesta.estado }));
  });
  vi.stubGlobal("fetch", fetchFalso);
  return {
    pedidos,
    /** Cambia lo que responde una ruta a partir de ahora. */
    responder(clave: string, respuesta: Manejador | Respuesta) {
      rutas[clave] = respuesta;
    },
  };
}
