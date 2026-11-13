// Uso: pnpm importar-alumnos <planilla.xlsx> [--cargar]
// Importa la hoja «Alumnos» de la planilla de Stretch Inn (0022). Sin --cargar, solo muestra qué
// cargaría y qué conviene revisar. Con --cargar, carga por la API entrando con un usuario real
// del centro (IMPORTADOR_*, en el .env: nunca en el repo). Repetirlo no duplica.
import { readFileSync } from "node:fs";
import { entrarALaApi } from "./importacion/api.ts";
import { cargarFilas } from "./importacion/cargar.ts";
import { leerPlanilla, type FilaDeLaPlanilla } from "./importacion/planilla.ts";

const [archivo, ...opciones] = process.argv.slice(2);
if (archivo === undefined) {
  console.error("Uso: pnpm importar-alumnos <planilla.xlsx> [--cargar]");
  process.exit(1);
}

const { filas, problemas } = await leerPlanilla(readFileSync(archivo));

function resumen(leidas: readonly FilaDeLaPlanilla[]): void {
  console.log(`Filas para cargar: ${String(leidas.length)}`);
  console.log(
    `Sin celular (quedan pendientes de completar): ${String(leidas.filter((f) => f.telefono === null).length)}`,
  );
  console.log(`Inactivos (se dan de baja): ${String(leidas.filter((f) => !f.activo).length)}`);
  console.log(`Con datos de salud: ${String(leidas.filter((f) => f.salud !== null).length)}`);
  const profes = [...new Set(leidas.flatMap((f) => (f.profe === null ? [] : [f.profe])))];
  console.log(`Profes de la planilla: ${profes.join(", ")}`);
  const revisar = leidas.filter((f) => f.revisarNombre);
  console.log(`\nNombres para revisar (${String(revisar.length)}), «nombre | apellido»:`);
  for (const f of revisar) console.log(`  fila ${String(f.fila)}: ${f.nombre} | ${f.apellido}`);
}

resumen(filas);
for (const { fila, mensaje } of problemas) console.log(`  fila ${String(fila)}: ${mensaje}`);

if (!opciones.includes("--cargar")) {
  console.log("\nNo se cargó nada. Para cargar: pnpm importar-alumnos <planilla.xlsx> --cargar");
  process.exit(0);
}

const variable = (nombre: string): string => {
  const valor = process.env[nombre];
  if (valor === undefined || valor === "") {
    console.error(`Falta ${nombre} en el .env (ver .env.example).`);
    process.exit(1);
  }
  return valor;
};
const centroId = process.env["IMPORTADOR_CENTRO"];
const api = await entrarALaApi({
  url: variable("IMPORTADOR_API_URL"),
  email: variable("IMPORTADOR_EMAIL"),
  clave: variable("IMPORTADOR_CLAVE"),
  origen: variable("IMPORTADOR_ORIGEN"),
  ...(centroId === undefined || centroId === "" ? {} : { centroId }),
});
const informe = await cargarFilas(filas, api);
console.log(`\nCreados: ${String(informe.creados)} · Ya estaban: ${String(informe.yaEstaban)}`);
if (informe.profesSinUsuario.length > 0) {
  console.log(
    `Profes sin usuario en el equipo (esos alumnos quedan sin profe): ${informe.profesSinUsuario.join(", ")}`,
  );
}
for (const { fila, mensaje } of informe.errores) console.log(`  fila ${String(fila)}: ${mensaje}`);
