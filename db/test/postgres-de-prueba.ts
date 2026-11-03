// Levanta un Postgres real y descartable para los tests de integración, en una carpeta temporal
// y en un puerto libre, con las migraciones aplicadas. Funciona igual en cualquier máquina y en
// el CI, sin Docker. Otros paquetes lo usan como globalSetup: "@app/db/pruebas".
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";
import { migrar } from "../src/migrar.ts";

declare module "vitest" {
  export interface ProvidedContext {
    urlDueno: string;
    urlApp: string;
    urlLogs: string;
  }
}

function puertoLibre(): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();
    servidor.once("error", rechazar);
    servidor.listen(0, () => {
      const direccion = servidor.address();
      const puerto = typeof direccion === "object" && direccion !== null ? direccion.port : 0;
      servidor.close(() => {
        resolver(puerto);
      });
    });
  });
}

/**
 * En Windows, embedded-postgres detiene Postgres con taskkill y los archivos tardan un momento
 * en liberarse: se reintenta el borrado. Si igual no se puede, avisa en vez de fallar.
 */
async function borrarAlTerminar(carpeta: string): Promise<void> {
  for (let intento = 1; existsSync(carpeta); intento++) {
    try {
      rmSync(carpeta, { recursive: true, force: true });
    } catch (error) {
      if (intento === 60) {
        console.warn(`No se pudo borrar ${carpeta}; se puede borrar a mano.`, error);
        return;
      }
      await setTimeout(250);
    }
  }
}

export default async function preparar(proyecto: TestProject): Promise<() => Promise<void>> {
  const carpeta = mkdtempSync(join(tmpdir(), "postgres-prueba-"));
  const puerto = await puertoLibre();
  const postgres = new EmbeddedPostgres({
    databaseDir: carpeta,
    user: "postgres",
    password: "clave-prueba",
    port: puerto,
    // La carpeta la borra borrarAlTerminar: la librería lo intenta antes de que se libere.
    persistent: true,
    onLog: () => undefined,
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("stretch_inn_test");

  const base = `localhost:${puerto}/stretch_inn_test`;
  const urls = {
    urlDueno: `postgres://postgres:clave-prueba@${base}`,
    urlApp: `postgres://app_usuario:clave-app-prueba@${base}`,
    urlLogs: `postgres://logs_lector:clave-logs-prueba@${base}`,
  };
  await migrar(urls);
  proyecto.provide("urlDueno", urls.urlDueno);
  proyecto.provide("urlApp", urls.urlApp);
  proyecto.provide("urlLogs", urls.urlLogs);

  return async () => {
    await postgres.stop();
    await borrarAlTerminar(carpeta);
  };
}
