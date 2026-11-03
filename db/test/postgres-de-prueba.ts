// Levanta un Postgres real y descartable para los tests de integración, en una carpeta temporal
// y en un puerto libre, con las migraciones aplicadas. Funciona igual en cualquier máquina y en
// el CI, sin Docker. Otros paquetes lo usan como globalSetup: "@app/db/pruebas".
// Postgres corre en un proceso hijo (postgres-proceso.ts); ahí está explicado por qué.
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    urlDueno: string;
    urlApp: string;
    urlLogs: string;
  }
}

interface Listo {
  listo: true;
  urlDueno: string;
  urlApp: string;
  urlLogs: string;
}

function esListo(mensaje: unknown): mensaje is Listo {
  return typeof mensaje === "object" && mensaje !== null && "listo" in mensaje;
}

export default async function preparar(proyecto: TestProject): Promise<() => Promise<void>> {
  const hijo = fork(join(import.meta.dirname, "postgres-proceso.ts"), [], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const urls = await new Promise<Listo>((resolver, rechazar) => {
    hijo.on("message", (mensaje) => {
      if (esListo(mensaje)) resolver(mensaje);
    });
    hijo.once("exit", (codigo) => {
      rechazar(new Error(`El Postgres de prueba terminó antes de estar listo (código ${codigo}).`));
    });
  });
  proyecto.provide("urlDueno", urls.urlDueno);
  proyecto.provide("urlApp", urls.urlApp);
  proyecto.provide("urlLogs", urls.urlLogs);

  return async () => {
    const terminado = once(hijo, "exit");
    hijo.send("detener");
    await terminado;
  };
}
