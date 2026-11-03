// Arma la app HTTP. Sin lógica de negocio: los módulos registran sus rutas.
import type { Permiso } from "@app/nucleo";
import { codigoDeTraza, nuevaTraza, type Logger } from "@app/plataforma";
import Fastify, {
  LogController,
  type FastifyError,
  type FastifyInstance,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Permiso que exige la ruta (0007). */
    permiso?: Permiso;
    /** Ruta sin login, como /salud. Tiene que declararse a propósito. */
    publica?: boolean;
  }
}

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
}

function exigirPermisoDeclarado(app: App): void {
  app.addHook("onRoute", (ruta) => {
    const config = ruta.config;
    if (config?.permiso === undefined && config?.publica !== true) {
      const metodo = Array.isArray(ruta.method) ? ruta.method.join(",") : ruta.method;
      throw new Error(
        `La ruta ${metodo} ${ruta.url} no declara permiso: agregá config.permiso o config.publica.`,
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

export function construirApp({ logger, comprobarBase }: DependenciasApp): App {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: nuevaTraza,
    logController: new LogController({ requestIdLogLabel: "traza" }),
  });
  exigirPermisoDeclarado(app);
  manejarErrores(app);
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
