import { describe, expect, it } from "vitest";
import { excedidos } from "../src/tamanos.ts";

const lineas = (n: number) => Array.from({ length: n }, (_, i) => `linea ${i}`).join("\n");

describe("excedidos", () => {
  it("marca los archivos de código que superan el límite de líneas", () => {
    const resultado = excedidos(
      [
        { ruta: "modulos/a/src/grande.ts", contenido: lineas(301) },
        { ruta: "modulos/a/src/chico.ts", contenido: lineas(300) },
      ],
      300,
    );
    expect(resultado).toEqual([{ ruta: "modulos/a/src/grande.ts", lineas: 301 }]);
  });

  it("también controla CSS", () => {
    const resultado = excedidos([{ ruta: "apps/web/src/estilos.css", contenido: lineas(400) }], 300);
    expect(resultado).toEqual([{ ruta: "apps/web/src/estilos.css", lineas: 400 }]);
  });

  it("no cuenta las líneas en blanco", () => {
    const contenido = `${lineas(300)}\n\n\n\n`;
    expect(excedidos([{ ruta: "a.ts", contenido }], 300)).toEqual([]);
  });

  it("ignora documentación, migraciones generadas y archivos que no son código", () => {
    const largo = lineas(1000);
    const resultado = excedidos(
      [
        { ruta: "docs/arquitectura.md", contenido: largo },
        { ruta: "db/migraciones/20261029_inicial.sql", contenido: largo },
        { ruta: "pnpm-lock.yaml", contenido: largo },
      ],
      300,
    );
    expect(resultado).toEqual([]);
  });
});
