// Lo que comparten la API y las rutas de los módulos: cómo declara una ruta lo que exige (0007),
// la cookie de sesión y el contexto del pedido (0017).
import type { ContextoCentro, Permiso, SedeId } from "@app/nucleo";
import type { FastifyReply, FastifyRequest } from "fastify";

/** El centro con el que trabaja la sesión, con su contexto ya limitado a la sede activa. */
export interface CentroDelPedido {
  contexto: ContextoCentro;
  /** Una sede puntual o «Todas mis sedes». */
  sedeActiva: SedeId | "todas";
  /** Sedes donde tiene algún permiso: las opciones del selector. */
  sedes: SedeId[];
  /** Le quitaron los permisos en la sede que tenía y se lo pasó a otra: la pantalla avisa. */
  sedeCambiada: boolean;
}

/** La sesión resuelta por la API antes de llegar a la ruta. Los permisos se calcularon ahora. */
export interface SesionDelPedido {
  sesionId: string;
  cuentaId: string;
  debeCambiarClave: boolean;
  /** null mientras no eligió centro. */
  centro: CentroDelPedido | null;
}

declare module "fastify" {
  interface FastifyContextConfig {
    /** Permiso que exige la ruta en alguna sede del contexto (0007). */
    permiso?: Permiso;
    /** Ruta sin login, como /salud. Tiene que declararse a propósito. */
    publica?: boolean;
    /** Exige haber entrado pero ningún permiso: elegir centro, salir. */
    soloSesion?: boolean;
    /** Se puede usar con la clave temporal, antes de cambiarla: cambiar la clave, salir. */
    aunConClaveTemporal?: boolean;
  }
  interface FastifyRequest {
    sesion?: SesionDelPedido;
  }
}

/** `__Host-`: el navegador la acepta solo con Secure, Path=/ y sin Domain. */
const COOKIE = "__Host-sesion";
/** La sesión dura como máximo 7 días (0017); antes vence en la base si no se usa. */
const DURACION_SEGUNDOS = 7 * 24 * 60 * 60;
const ATRIBUTOS = "HttpOnly; Secure; SameSite=Lax";

export function tokenDelPedido(pedido: FastifyRequest): string | undefined {
  const cookies = pedido.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [nombre, ...valor] = cookie.trim().split("=");
    if (nombre === COOKIE) return valor.join("=") || undefined;
  }
  return undefined;
}

export function fijarCookieDeSesion(respuesta: FastifyReply, token: string): void {
  void respuesta.header(
    "set-cookie",
    `${COOKIE}=${token}; Path=/; Max-Age=${String(DURACION_SEGUNDOS)}; ${ATRIBUTOS}`,
  );
}

export function borrarCookieDeSesion(respuesta: FastifyReply): void {
  void respuesta.header("set-cookie", `${COOKIE}=; Path=/; Max-Age=0; ${ATRIBUTOS}`);
}

/** La sesión del pedido. Sin sesión es un error del programa: la ruta no es pública. */
export function sesionDe(pedido: FastifyRequest): SesionDelPedido {
  if (pedido.sesion === undefined) {
    throw new Error(`${pedido.method} ${pedido.url} usa la sesión, pero no la tiene.`);
  }
  return pedido.sesion;
}

/**
 * El contexto del centro activo, para pasarlo a enContexto. Las rutas con permiso siempre lo
 * tienen: la API rechaza antes el pedido sin centro.
 */
export function contextoDe(pedido: FastifyRequest): ContextoCentro {
  const centro = sesionDe(pedido).centro;
  if (centro === null) {
    throw new Error(`${pedido.method} ${pedido.url} usa el contexto sin centro elegido.`);
  }
  return centro.contexto;
}
