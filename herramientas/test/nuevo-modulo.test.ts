import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crearModulo } from "../src/nuevo-modulo.ts";

const raizTemporal = () => mkdtempSync(join(tmpdir(), "nuevo-modulo-"));

describe("crearModulo", () => {
  it("crea un módulo completo con las capas hexagonales", () => {
    const raiz = raizTemporal();
    crearModulo({ raiz, nombre: "asistencia", nivel: "completo" });

    const modulo = join(raiz, "modulos", "asistencia");
    for (const carpeta of ["dominio", "aplicacion", "infraestructura", "http"]) {
      expect(existsSync(join(modulo, "src", carpeta))).toBe(true);
    }
    const paquete = JSON.parse(readFileSync(join(modulo, "package.json"), "utf8")) as {
      name: string;
      exports: unknown;
    };
    expect(paquete.name).toBe("@app/asistencia");
    expect(paquete.exports).toEqual({ ".": "./src/index.ts" });
    expect(readFileSync(join(modulo, "CLAUDE.md"), "utf8")).toContain("Nivel: completo");
  });

  it("crea un módulo liviano solo con datos y http", () => {
    const raiz = raizTemporal();
    crearModulo({ raiz, nombre: "personas", nivel: "liviano" });

    const src = join(raiz, "modulos", "personas", "src");
    expect(existsSync(join(src, "datos"))).toBe(true);
    expect(existsSync(join(src, "http"))).toBe(true);
    expect(existsSync(join(src, "dominio"))).toBe(false);
  });

  it("rechaza nombres que no están en minúsculas con guiones", () => {
    expect(() => crearModulo({ raiz: raizTemporal(), nombre: "Asistencia", nivel: "liviano" })).toThrow(
      /nombre/,
    );
  });

  it("no pisa un módulo existente", () => {
    const raiz = raizTemporal();
    crearModulo({ raiz, nombre: "caja", nivel: "liviano" });
    expect(() => crearModulo({ raiz, nombre: "caja", nivel: "liviano" })).toThrow(/ya existe/);
  });
});
