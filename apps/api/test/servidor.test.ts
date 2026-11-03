// Arranca el servidor real como proceso, contra un Postgres de prueba (ver db/AGENTS.md).
import type {} from "@app/db/pruebas";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, inject, it } from "vitest";

const SERVIDOR = join(import.meta.dirname, "..", "src", "servidor.ts");
let proceso: ChildProcess | undefined;

function puertoLibre(): Promise<number> {
  return new Promise((resolver) => {
    const servidor = createServer().listen(0, () => {
      const direccion = servidor.address();
      servidor.close(() => {
        resolver(typeof direccion === "object" && direccion !== null ? direccion.port : 0);
      });
    });
  });
}

function arrancar(urlBase: string, puerto: number): { salida: () => string } {
  let salida = "";
  proceso = spawn(process.execPath, [SERVIDOR], {
    env: { ...process.env, DATABASE_URL: urlBase, PUERTO: String(puerto) },
  });
  proceso.stdout?.on("data", (trozo: Buffer) => (salida += trozo.toString()));
  proceso.stderr?.on("data", (trozo: Buffer) => (salida += trozo.toString()));
  return { salida: () => salida };
}

async function esperarSalud(puerto: number): Promise<Response> {
  for (let intento = 0; intento < 100; intento++) {
    try {
      return await fetch(`http://localhost:${puerto}/salud`);
    } catch {
      await new Promise((resolver) => setTimeout(resolver, 100));
    }
  }
  throw new Error("El servidor no respondió a tiempo.");
}

afterEach(() => {
  proceso?.kill();
  proceso = undefined;
});

describe("servidor", () => {
  it("arranca con app_usuario y /salud responde con la base real", async () => {
    const puerto = await puertoLibre();
    arrancar(inject("urlApp"), puerto);
    const respuesta = await esperarSalud(puerto);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: "ok" });
  });

  it("no arranca con un rol que saltea RLS (superusuario)", async () => {
    const puerto = await puertoLibre();
    const { salida } = arrancar(inject("urlDueno"), puerto);
    const [codigo] = (await once(proceso as ChildProcess, "exit")) as [number | null];
    expect(codigo).toBe(1);
    expect(salida()).toMatch(/saltea RLS/);
  });
});
