// Arma la app HTTP. Sin lógica de negocio: los módulos registran sus rutas.
import { codigoDeTraza, nuevaTraza, type Logger, type SesionDelPedido } from "@app/plataforma";
import Fastify, {
  LogController,
  type FastifyError,
  type FastifyInstance,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from "fastify";
import { exigirSesion } from "./base/sesion.ts";

/** La app de Fastify con nuestro logger. */
export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  Logger
>;

export interface DependenciasApp {
  logger: Logger;
  /** Falla si la base no responde. */
  comprobarBase: () => Promise<void>;
  /** Origen del panel (https://app.dominio): único aceptado en pedidos que cambian datos. */
  origenPanel: string;
  /** La sesión del token de la cookie, o undefined si no existe, venció o fue revocada. */
  resolverSesion: (token: string) => Promise<SesionDelPedido | undefined>;
  /**
   * Detrás del proxy de Railway: la IP real llega en X-Forwarded-For. Sin esto, el límite de
   * intentos de login vería a todos con la IP del proxy (0017).
   */
  detrasDeProxy?: boolean;
}

function exigirPermisoDeclarado(app: App): void {
  app.addHook("onRoute", (ruta) => {
    const config = ruta.config;
    if (config?.permiso === undefined && config?.publica !== true && config?.soloSesion !== true) {
      const metodo = Array.isArray(ruta.method) ? ruta.method.join(",") : ruta.method;
      throw new Error(
        `La ruta ${metodo} ${ruta.url} no declara permiso: agregá config.permiso, config.soloSesion o config.publica.`,
      );
    }
  });
}

function manejarErrores(app: App): void {
  app.setNotFoundHandler((pedido, respuesta) => {
    void respuesta.code(404).send({
      error: { codigo: "no-encontrado", mensaje: `No existe ${pedido.method} ${pedido.url}.` },
    });
  });
  app.setErrorHandler((error: FastifyError, pedido, respuesta) => {
    // Errores del pedido (JSON mal formado, validación): se le explican al usuario.
    if (error.statusCode !== undefined && error.statusCode < 500) {
      return respuesta
        .code(error.statusCode)
        .send({ error: { codigo: "pedido-invalido", mensaje: error.message } });
    }
    // Bug: se registra con todo su contexto y el usuario ve solo el código (0016).
    pedido.log.error(
      { err: error, ruta: pedido.routeOptions.url, metodo: pedido.method },
      "Error no previsto al atender el pedido.",
    );
    return respuesta.code(500).send({
      error: {
        codigo: "error-interno",
        mensaje: `Algo falló. Código: ${codigoDeTraza(pedido.id)}`,
      },
    });
  });
}

export function construirApp({
  logger,
  comprobarBase,
  origenPanel,
  resolverSesion,
  detrasDeProxy = false,
}: DependenciasApp): App {
  // Un solo salto: el proxy de Railway. Con `true` se tomaría la primera IP de X-Forwarded-For,
  // que la inventa el cliente, y cambiándola se esquiva el límite de intentos.
  // El salto 0 es quien se conecta al socket: el proxy. La IP que él agregó es la del cliente.
  const app = Fastify({
    trustProxy: (_direccion: string, salto: number) => detrasDeProxy && salto === 0,
    loggerInstance: logger,
    genReqId: nuevaTraza,
    logController: new LogController({ requestIdLogLabel: "traza" }),
  });
  exigirPermisoDeclarado(app);
  manejarErrores(app);
  app.addHook("onRequest", exigirSesion({ origenPanel, resolverSesion }));
  app.addHook("onSend", async (pedido, respuesta) => {
    void respuesta.header("x-traza", pedido.id);
  });

  app.get("/salud", { config: { publica: true } }, async (pedido, respuesta) => {
    try {
      await comprobarBase();
      return { estado: "ok" };
    } catch (error) {
      pedido.log.error({ err: error }, "La base no responde al chequeo de salud.");
      return respuesta.code(503).send({ estado: "sin-base" });
    }
  });
  return app;
}
