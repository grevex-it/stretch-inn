// Secciones que tiene que tener el AGENTS.md de cada módulo (ver docs/decisiones/0005).
// Las usan el generador de módulos y el control de instrucciones.

export const SECCIONES_MODULO = [
  "Alcance",
  "Fuera de alcance",
  "Depende de",
  "API pública",
  "Eventos",
  "Invariantes",
  "Glosario",
  "Configuración por centro",
  "Pendientes",
] as const;

export const CONTENIDO_CLAUDE_MD = "@AGENTS.md\n";
