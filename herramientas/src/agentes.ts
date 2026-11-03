// Control de las instrucciones para agentes (ver docs/decisiones/0005).
import { posix } from "node:path";
import { CONTENIDO_CLAUDE_MD, SECCIONES_MODULO } from "./plantilla-agents.ts";
import type { Archivo } from "./tamanos.ts";

const PAQUETE_MODULO = /^modulos\/[^/]+\/package\.json$/;

function junto(ruta: string, nombre: string): string {
  const carpeta = posix.dirname(ruta);
  return carpeta === "." ? nombre : posix.join(carpeta, nombre);
}

function controlarPares(archivos: Archivo[], porRuta: Map<string, string>): string[] {
  const problemas: string[] = [];
  for (const { ruta } of archivos.filter(
    (archivo) => posix.basename(archivo.ruta) === "AGENTS.md",
  )) {
    const claude = porRuta.get(junto(ruta, "CLAUDE.md"));
    if (claude === undefined) {
      problemas.push(`${ruta}: falta CLAUDE.md al lado, con solo «@AGENTS.md».`);
    } else if (claude.replace(/\r\n/g, "\n") !== CONTENIDO_CLAUDE_MD) {
      problemas.push(`${junto(ruta, "CLAUDE.md")}: tiene que contener solo «@AGENTS.md».`);
    }
  }
  return problemas;
}

function seccion(markdown: string, titulo: string): string | undefined {
  const partes = markdown.split(/^## /m);
  const encontrada = partes.find((parte) => parte.split("\n", 1)[0]?.trim() === titulo);
  return encontrada?.slice(titulo.length);
}

function dependenciasApp(paqueteJson: string): Set<string> {
  const paquete = JSON.parse(paqueteJson) as { dependencies?: Record<string, string> };
  return new Set(Object.keys(paquete.dependencies ?? {}).filter((dep) => dep.startsWith("@app/")));
}

function controlarDependencias(ruta: string, dependeDe: string, paqueteJson: string): string[] {
  const nombradas = new Set(dependeDe.match(/@app\/[a-z0-9-]+/g) ?? []);
  const declaradas = dependenciasApp(paqueteJson);
  const sobran = [...nombradas].filter((dep) => !declaradas.has(dep));
  const faltan = [...declaradas].filter((dep) => !nombradas.has(dep));
  return [
    ...sobran.map((dep) => `${ruta}: «Depende de» nombra ${dep}, que no está en package.json.`),
    ...faltan.map((dep) => `${ruta}: «Depende de» no nombra ${dep}, que está en package.json.`),
  ];
}

function controlarModulo(rutaPaquete: string, porRuta: Map<string, string>): string[] {
  const rutaAgents = junto(rutaPaquete, "AGENTS.md");
  const agents = porRuta.get(rutaAgents);
  if (agents === undefined) return [`${posix.dirname(rutaPaquete)}: falta AGENTS.md.`];

  const problemas = SECCIONES_MODULO.filter((titulo) => seccion(agents, titulo) === undefined).map(
    (titulo) => `${rutaAgents}: falta la sección «${titulo}».`,
  );
  const dependeDe = seccion(agents, "Depende de");
  const paquete = porRuta.get(rutaPaquete) ?? "{}";
  if (dependeDe !== undefined)
    problemas.push(...controlarDependencias(rutaAgents, dependeDe, paquete));
  return problemas;
}

export function problemasDeInstrucciones(archivos: Archivo[]): string[] {
  const porRuta = new Map(archivos.map((archivo) => [archivo.ruta, archivo.contenido]));
  const modulos = archivos.filter((archivo) => PAQUETE_MODULO.test(archivo.ruta));
  return [
    ...controlarPares(archivos, porRuta),
    ...modulos.flatMap((modulo) => controlarModulo(modulo.ruta, porRuta)),
  ];
}
