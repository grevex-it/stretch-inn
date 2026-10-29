// Uso: pnpm nuevo-modulo <nombre> <completo|liviano>
import { crearModulo, type Nivel } from "./nuevo-modulo.ts";

const [nombre, nivel] = process.argv.slice(2);
if (nombre === undefined || (nivel !== "completo" && nivel !== "liviano")) {
  console.error("Uso: pnpm nuevo-modulo <nombre> <completo|liviano>");
  process.exit(1);
}
const ruta = crearModulo({ raiz: process.cwd(), nombre, nivel: nivel satisfies Nivel });
console.log(`Módulo creado en ${ruta}. Completá su CLAUDE.md y corré pnpm install.`);
