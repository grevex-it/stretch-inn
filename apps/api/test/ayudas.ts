// App de prueba sin base: la sesión la resuelve un doble según el token de la cookie.
import { id, type Permiso } from "@app/nucleo";
import { crearLogger, type SesionDelPedido } from "@app/plataforma";
import { Writable } from "node:stream";
import { construirApp } from "../src/app.ts";

export const PANEL = "https://app.ejemplo.com";
const NORTE = id<"Sede">("norte");

/** Una sesión con los permisos indicados en la sede Norte, o sin centro si es null. */
export function sesionCon(
  permisos: Permiso[] | null,
  opciones: { debeCambiarClave?: boolean } = {},
): SesionDelPedido {
  return {
    sesionId: "sesion-1",
    cuentaId: "cuenta-1",
    debeCambiarClave: opciones.debeCambiarClave ?? false,
    centro:
      permisos === null
        ? null
        : {
            contexto: {
              centroId: id("centro-1"),
              actor: { tipo: "usuario", usuarioId: id("usuario-1") },
              permisosPorSede: new Map([[NORTE, new Set(permisos)]]),
            },
            sedeActiva: NORTE,
            sedes: [NORTE],
            sedeCambiada: false,
          },
  };
}

export interface OpcionesDePrueba {
  comprobarBase?: (() => Promise<void>) | undefined;
  sesiones?: Record<string, SesionDelPedido>;
  detrasDeProxy?: boolean;
}

export function appDePrueba(opciones: OpcionesDePrueba = {}) {
  const crudo: string[] = [];
  const destino = new Writable({
    write(trozo: Buffer, _codificacion, listo) {
      crudo.push(trozo.toString());
      listo();
    },
  });
  const logs = () =>
    crudo
      .join("")
      .split("\n")
      .filter((linea) => linea !== "")
      .map((linea) => JSON.parse(linea) as Record<string, unknown>);
  const tokensPedidos: string[] = [];
  const app = construirApp({
    logger: crearLogger({ nivel: "info", destino }),
    comprobarBase: opciones.comprobarBase ?? (() => Promise.resolve()),
    origenPanel: PANEL,
    detrasDeProxy: opciones.detrasDeProxy ?? false,
    resolverSesion: (token) => {
      tokensPedidos.push(token);
      return Promise.resolve(opciones.sesiones?.[token]);
    },
  });
  return { app, logs, tokensPedidos };
}

export const conCookie = (token: string) => ({ cookie: `__Host-sesion=${token}` });
