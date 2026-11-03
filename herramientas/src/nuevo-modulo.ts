import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENIDO_CLAUDE_MD, SECCIONES_MODULO } from "./plantilla-agents.ts";

export type Nivel = "completo" | "liviano";

export interface OpcionesModulo {
  raiz: string;
  nombre: string;
  nivel: Nivel;
}

const CAPAS: Record<Nivel, string[]> = {
  completo: ["dominio", "aplicacion", "infraestructura", "http"],
  liviano: ["datos", "http"],
};

const NOMBRE_VALIDO = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function paquete(nombre: string): string {
  const contenido = {
    name: `@app/${nombre}`,
    private: true,
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: {
      tipos: "tsc -p tsconfig.json",
      test: "vitest run --passWithNoTests --fsModuleCachePath node_modules/.vitest-cache",
    },
    dependencies: { "@app/nucleo": "workspace:*" },
  };
  return `${JSON.stringify(contenido, null, 2)}\n`;
}

const GUIAS: Record<(typeof SECCIONES_MODULO)[number], string> = {
  Alcance: "_Qué hace este módulo._",
  "Fuera de alcance": "_Qué no hace y qué módulo se encarga._",
  "Depende de": "- `@app/nucleo`",
  "API pública": "_Casos de uso exportados en `src/index.ts` y sus tipos._",
  Eventos: "- Emite: _ninguno por ahora_.\n- Escucha: _ninguno por ahora_.",
  Invariantes: "_Reglas que nunca se pueden romper._",
  Glosario: "_Términos del módulo._",
  "Configuración por centro": "_Ninguna por ahora._",
  Pendientes: "_Decisiones abiertas._",
};

function agentsMd(nombre: string, nivel: Nivel): string {
  const capas = CAPAS[nivel].map((capa) => `\`src/${capa}/\``).join(", ");
  const secciones = SECCIONES_MODULO.map((seccion) => `## ${seccion}\n\n${GUIAS[seccion]}\n`);
  return `# Módulo ${nombre}

Nivel: ${nivel} (${capas}). Ver \`docs/decisiones/0003-hexagonal-por-niveles.md\`.

${secciones.join("\n")}`;
}

export function crearModulo({ raiz, nombre, nivel }: OpcionesModulo): string {
  if (!NOMBRE_VALIDO.test(nombre)) {
    throw new Error(`El nombre "${nombre}" no es válido: usá minúsculas con guiones (ej. "caja").`);
  }
  const modulo = join(raiz, "modulos", nombre);
  if (existsSync(modulo)) throw new Error(`El módulo "${nombre}" ya existe.`);

  for (const capa of CAPAS[nivel]) {
    mkdirSync(join(modulo, "src", capa), { recursive: true });
    writeFileSync(join(modulo, "src", capa, ".gitkeep"), "");
  }
  mkdirSync(join(modulo, "test"), { recursive: true });
  writeFileSync(join(modulo, "test", ".gitkeep"), "");
  writeFileSync(join(modulo, "package.json"), paquete(nombre));
  writeFileSync(
    join(modulo, "tsconfig.json"),
    `${JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src", "test"] }, null, 2)}\n`,
  );
  writeFileSync(join(modulo, "AGENTS.md"), agentsMd(nombre, nivel));
  writeFileSync(join(modulo, "CLAUDE.md"), CONTENIDO_CLAUDE_MD);
  writeFileSync(
    join(modulo, "src", "index.ts"),
    "// API pública del módulo. Lo único que pueden importar los demás.\nexport {};\n",
  );
  return modulo;
}
