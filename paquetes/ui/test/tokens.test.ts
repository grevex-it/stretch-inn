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
