// Controla el tamaño de todos los archivos de código del repo, CSS incluido.
// ESLint ya controla TypeScript; esto cubre además CSS y cualquier archivo que ESLint no vea.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { excedidos, LIMITE_LINEAS } from "./tamanos.ts";

const rutas = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((ruta) => ruta !== "");

const archivos = rutas.map((ruta) => ({ ruta, contenido: readFileSync(ruta, "utf8") }));
const resultado = excedidos(archivos, LIMITE_LINEAS);

if (resultado.length > 0) {
  console.error(`Archivos con más de ${LIMITE_LINEAS} líneas (dividilos por responsabilidad):`);
  for (const { ruta, lineas } of resultado) console.error(`  ${ruta}: ${lineas}`);
  process.exit(1);
}
console.log(`Tamaños OK: ${archivos.length} archivos revisados.`);
