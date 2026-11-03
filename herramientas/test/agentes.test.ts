import { describe, expect, it } from "vitest";
import { problemasDeInstrucciones } from "../src/agentes.ts";
import type { Archivo } from "../src/tamanos.ts";

const SECCIONES = [
  "Alcance",
  "Fuera de alcance",
  "Depende de",
  "API pública",
  "Eventos",
  "Invariantes",
  "Glosario",
  "Configuración por centro",
  "Pendientes",
];

function agentsModulo(dependeDe: string[], sinSeccion?: string): string {
  return SECCIONES.filter((seccion) => seccion !== sinSeccion)
    .map((seccion) =>
      seccion === "Depende de"
        ? `## ${seccion}\n\n${dependeDe.map((dep) => `- \`${dep}\``).join("\n")}\n`
        : `## ${seccion}\n\n_Nada._\n`,
    )
    .join("\n");
}

function paquete(dependencias: string[]): string {
  const deps = Object.fromEntries(dependencias.map((dep) => [dep, "workspace:*"]));
  return JSON.stringify({ name: "@app/caja", dependencies: { zod: "^4.0.0", ...deps } });
}

function moduloCaja(opciones: {
  dependeDe?: string[];
  dependencias?: string[];
  sinSeccion?: string;
}): Archivo[] {
  return [
    {
      ruta: "modulos/caja/package.json",
      contenido: paquete(opciones.dependencias ?? ["@app/nucleo"]),
    },
    {
      ruta: "modulos/caja/AGENTS.md",
      contenido: agentsModulo(opciones.dependeDe ?? ["@app/nucleo"], opciones.sinSeccion),
    },
    { ruta: "modulos/caja/CLAUDE.md", contenido: "@AGENTS.md\n" },
  ];
}

describe("problemasDeInstrucciones", () => {
  it("acepta un módulo completo y coherente", () => {
    expect(problemasDeInstrucciones(moduloCaja({}))).toEqual([]);
  });

  it("exige un CLAUDE.md al lado de cada AGENTS.md", () => {
    const archivos = [{ ruta: "AGENTS.md", contenido: "# Raíz\n" }];
    expect(problemasDeInstrucciones(archivos)).toEqual([
      "AGENTS.md: falta CLAUDE.md al lado, con solo «@AGENTS.md».",
    ]);
  });

  it("exige que el CLAUDE.md contenga solo @AGENTS.md", () => {
    const archivos = [
      { ruta: "AGENTS.md", contenido: "# Raíz\n" },
      { ruta: "CLAUDE.md", contenido: "@AGENTS.md\nOtra regla\n" },
    ];
    expect(problemasDeInstrucciones(archivos)).toEqual([
      "CLAUDE.md: tiene que contener solo «@AGENTS.md».",
    ]);
  });

  it("exige un AGENTS.md en cada módulo", () => {
    const archivos = moduloCaja({}).filter((archivo) => !archivo.ruta.endsWith(".md"));
    expect(problemasDeInstrucciones(archivos)).toEqual(["modulos/caja: falta AGENTS.md."]);
  });

  it("exige todas las secciones de la plantilla", () => {
    expect(problemasDeInstrucciones(moduloCaja({ sinSeccion: "Invariantes" }))).toEqual([
      "modulos/caja/AGENTS.md: falta la sección «Invariantes».",
    ]);
  });

  it("exige que «Depende de» coincida con las dependencias @app/* del package.json", () => {
    const archivos = moduloCaja({
      dependeDe: ["@app/nucleo", "@app/agenda"],
      dependencias: ["@app/nucleo", "@app/plataforma"],
    });
    expect(problemasDeInstrucciones(archivos)).toEqual([
      "modulos/caja/AGENTS.md: «Depende de» nombra @app/agenda, que no está en package.json.",
      "modulos/caja/AGENTS.md: «Depende de» no nombra @app/plataforma, que está en package.json.",
    ]);
  });
});
