// Cliente de la API: el único lugar del panel que hace fetch. Las pantallas lo usan a través de
// TanStack Query (ver AGENTS.md). Las respuestas se validan con @app/contratos.
import type { z } from "zod";

/** La API vive en el mismo origen, bajo /api: así la cookie de sesión viaja sola (0017). */
const BASE = "/api";

/** Un error que se le puede mostrar al usuario: el mensaje ya viene en sus palabras. */
export class ErrorDeApi extends Error {
  readonly estado: number;
  readonly codigo: string;

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.estado = estado;
    this.codigo = codigo;
  }
}

const SIN_CONEXION = "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";
const ALGO_FALLO = "Algo falló. Probá de nuevo en un rato.";

async function pedido(metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  const init: RequestInit = { method: metodo, credentials: "same-origin" };
  if (cuerpo !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(cuerpo);
  }
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, init);
  } catch {
    throw new ErrorDeApi(0, "sin-conexion", SIN_CONEXION);
  }
  if (!respuesta.ok) throw await errorDe(respuesta);
  return respuesta;
}

/** La API responde `{ error: { codigo, mensaje } }`; si no, un mensaje genérico. */
async function errorDe(respuesta: Response): Promise<ErrorDeApi> {
  const cuerpo: unknown = await respuesta.json().catch(() => undefined);
  if (typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo) {
    const { error } = cuerpo;
    if (typeof error === "object" && error !== null && "codigo" in error && "mensaje" in error) {
      return new ErrorDeApi(respuesta.status, String(error.codigo), String(error.mensaje));
    }
  }
  return new ErrorDeApi(respuesta.status, "error", ALGO_FALLO);
}

/** GET validado con el contrato. Una respuesta que no lo cumple es un error, no un dato a medias. */
export async function consultar<T>(ruta: string, esquema: z.ZodType<T>): Promise<T> {
  const respuesta = await pedido("GET", ruta);
  const resultado = esquema.safeParse(await respuesta.json().catch(() => undefined));
  if (!resultado.success) {
    throw new ErrorDeApi(respuesta.status, "respuesta-invalida", ALGO_FALLO);
  }
  return resultado.data;
}

/** POST, PUT o DELETE. La respuesta se ignora: las pantallas vuelven a consultar lo que cambió. */
export async function enviar(
  metodo: "POST" | "PUT" | "DELETE",
  ruta: string,
  cuerpo?: unknown,
): Promise<void> {
  await pedido(metodo, ruta, cuerpo);
}
