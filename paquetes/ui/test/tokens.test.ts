import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tokens, variable, type Token } from "../src/index.ts";

const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");

function variablesDelCss(texto: string): Map<string, string> {
  const encontradas = new Map<string, string>();
  for (const [, nombre, valor] of texto.matchAll(/--(si-[a-z0-9-]+):\s*([^;]+);/g)) {
    if (nombre !== undefined && valor !== undefined) encontradas.set(nombre, valor.trim());
  }
  return encontradas;
}

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = canales.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(texto: Token, fondo: Token): number {
  const a = luminancia(tokens[texto]);
  const b = luminancia(tokens[fondo]);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("tokens", () => {
  it("tokens.css y tokens.ts tienen los mismos nombres y valores", () => {
    expect(Object.fromEntries(variablesDelCss(css))).toEqual(tokens);
  });

  it("variable() devuelve la variable CSS del token", () => {
    expect(variable("si-oliva-700")).toBe("var(--si-oliva-700)");
  });
});

describe("escalas", () => {
  const espacios: [Token, number][] = [
    ["si-espacio-1", 4],
    ["si-espacio-2", 8],
    ["si-espacio-3", 12],
    ["si-espacio-4", 16],
    ["si-espacio-5", 20],
    ["si-espacio-6", 24],
    ["si-espacio-8", 32],
  ];

  it.each(espacios)("%s mide %ipx: la escala va de 4 en 4", (token, px) => {
    expect(tokens[token]).toBe(`${px}px`);
  });

  const letras: Token[] = [
    "si-letra-chica",
    "si-letra-normal",
    "si-letra-media",
    "si-letra-grande",
    "si-letra-titulo",
  ];

  it("los tamaños de letra van en rem y crecen de chica a título", () => {
    const valores = letras.map((token) => {
      const valor = tokens[token];
      expect(valor).toMatch(/^[0-9.]+rem$/);
      return parseFloat(valor);
    });
    expect(valores).toEqual([...valores].sort((a, b) => a - b));
    expect(new Set(valores).size).toBe(valores.length);
  });

  it("el texto normal es el del documento: 1rem", () => {
    expect(tokens["si-letra-normal"]).toBe("1rem");
  });
});

describe("contraste (WCAG AA)", () => {
  const textoNormal: [Token, Token][] = [
    ["si-texto", "si-crema-50"],
    ["si-texto-medio", "si-crema-50"],
    ["si-texto-suave", "si-crema-50"],
    ["si-texto-suave", "si-superficie"],
    ["si-texto-suave", "si-crema-200"],
    ["si-crema-50", "si-oliva-700"],
    ["si-texto-sobre-oliva", "si-oliva-900"],
    ["si-texto-sobre-oliva", "si-oliva-600"],
    ["si-texto-sobre-oliva", "si-oliva-500"],
    ["si-ok-texto", "si-ok-fondo"],
    ["si-neutro-texto", "si-neutro-fondo"],
    ["si-alerta-texto", "si-alerta-fondo"],
    ["si-error-texto", "si-superficie"],
  ];

  it.each(textoNormal)("%s sobre %s llega a 4.5:1", (texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  const noTexto: [Token, Token][] = [
    ["si-borde-control", "si-superficie"],
    ["si-borde-control", "si-crema-50"],
    ["si-foco", "si-crema-50"],
    ["si-foco-sobre-oliva", "si-oliva-600"],
  ];

  it.each(noTexto)("%s sobre %s llega a 3:1", (borde, fondo) => {
    expect(contraste(borde, fondo)).toBeGreaterThanOrEqual(3);
  });
});
