// Tokens de la identidad visual (ver docs/decisiones/0018-identidad-visual.md).
// Los mismos valores que src/tokens.css; test/tokens.test.ts controla que coincidan.
// En CSS se usan siempre como variables: `var(--si-oliva-700)`. Este objeto es para
// los pocos casos en que hace falta el valor desde TypeScript (por ejemplo, gráficos).

export const tokens = {
  "si-oliva-900": "#36432f",
  "si-oliva-800": "#2e3828",
  "si-oliva-700": "#3b4733",
  "si-oliva-600": "#4f5a42",
  "si-oliva-500": "#646854",
  "si-oliva-400": "#7b8a64",
  "si-degrade-marca": "linear-gradient(160deg, #36432f 0%, #4f5a42 45%, #646854 100%)",

  "si-crema-50": "#f6f1e8",
  "si-crema-100": "#f3ece2",
  "si-crema-200": "#eee7da",
  "si-crema-300": "#e9e1d3",
  "si-superficie": "#fffdf9",

  "si-texto": "#232b1d",
  "si-texto-medio": "#3e4535",
  "si-texto-suave": "#555b4a",
  "si-texto-sobre-oliva": "#f3ece2",

  "si-borde": "#e4dccd",
  "si-borde-control": "#8f887a",

  "si-ok-fondo": "#dce5cc",
  "si-ok-texto": "#2e3828",
  "si-neutro-fondo": "#f1ebdf",
  "si-neutro-texto": "#4a4f3f",
  "si-alerta-fondo": "#f3e3d6",
  "si-alerta-texto": "#6b3a1f",
  "si-error-texto": "#8a3b12",

  "si-foco": "#3b4733",
  "si-foco-sobre-oliva": "#f3ece2",

  "si-fuente": '"Jost", system-ui, sans-serif',
  "si-peso-liviano": "300",
  "si-peso-normal": "400",
  "si-peso-medio": "500",

  "si-radio-sm": "10px",
  "si-radio-md": "12px",
  "si-radio-lg": "20px",
  "si-radio-pildora": "999px",
  "si-alto-control": "48px",
  "si-alto-control-min": "44px",
  "si-sombra-flotante": "0 12px 32px rgb(35 43 29 / 14%)",
} as const;

export type Token = keyof typeof tokens;

/** La variable CSS de un token, para estilos armados desde TypeScript. */
export function variable(token: Token): string {
  return `var(--${token})`;
}
