// Controla que las instrucciones para agentes estén completas y no mientan (ver 0005).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { problemasDeInstrucciones } from "./agentes.ts";

const RELEVANTES = /(^|\/)(AGENTS|CLAUDE)\.md$|^modulos\/[^/]+\/package\.json$/;

const rutas = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((ruta) => RELEVANTES.test(ruta));

const archivos = rutas.map((ruta) => ({ ruta, contenido: readFileSync(ruta, "utf8") }));
const problemas = problemasDeInstrucciones(archivos);

if (problemas.length > 0) {
  console.error("Instrucciones para agentes con problemas:");
  for (const problema of problemas) console.error(`  ${problema}`);
  process.exit(1);
}
console.log(`Instrucciones OK: ${archivos.length} archivos revisados.`);
