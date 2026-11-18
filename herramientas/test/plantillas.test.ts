// Guardián de las plantillas de roles (0007). Los centros nuevos las copian del código
// (plantillasDelSistema) y los que ya existían las reciben por migración
// (identidad_dar_a_plantilla): las dos fuentes tienen que dar los mismos permisos.
import { plantillasDelSistema } from "@app/identidad";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO } from "../src/catalogo.ts";

const MIGRACIONES = join(import.meta.dirname, "..", "..", "db", "migraciones");

/** Por plantilla, los permisos que le dan las llamadas a identidad_dar_a_plantilla del SQL. */
function permisosDadosAPlantillas(sql: string): Map<string, Set<string>> {
  const dados = new Map<string, Set<string>>();
  const llamadas = sql.matchAll(
    /identidad_dar_a_plantilla\s*\(\s*'([^']+)'\s*,\s*array\s*\[([^\]]*)\]/gi,
  );
  for (const [, plantilla = "", lista = ""] of llamadas) {
    const permisos = dados.get(plantilla) ?? new Set<string>();
    for (const [, permiso = ""] of lista.matchAll(/'([^']+)'/g)) permisos.add(permiso);
    dados.set(plantilla, permisos);
  }
  return dados;
}

function dadosEnLasMigraciones(): Map<string, Set<string>> {
  const sql = readdirSync(MIGRACIONES)
    .filter((archivo) => archivo.endsWith(".sql"))
    .map((archivo) => readFileSync(join(MIGRACIONES, archivo), "utf8"))
    .join("\n");
  return permisosDadosAPlantillas(sql);
}

const ordenados = (permisos: Iterable<string>) => [...permisos].sort();

/** Lo acordado para Stretch Inn el 18/11 (0007 y 0019), con el catálogo completo. */
const ACORDADO: Record<string, string[]> = {
  encargado: [
    "usuarios.ver",
    ...["personas.ver", "personas.editar", "personas.dar-de-baja"],
    ...["personas.ver-salud", "personas.editar-salud"],
    ...["agenda.ver", "agenda.gestionar", "agenda.inscribir"],
    ...["asistencia.ver", "asistencia.tomar", "asistencia.avisar", "asistencia.recuperar"],
    ...["abonos.ver", "abonos.asignar"],
    ...["caja.ver", "caja.cobrar", "caja.anular"],
    ...["gastos.ver", "gastos.cargar", "gastos.anular"],
  ],
  profesor: [
    ...["personas.ver", "personas.editar", "personas.dar-de-baja"],
    ...["personas.ver-salud", "personas.editar-salud"],
    ...["agenda.ver", "agenda.gestionar", "agenda.inscribir"],
    ...["asistencia.ver", "asistencia.tomar", "asistencia.avisar", "asistencia.recuperar"],
    ...["abonos.ver", "abonos.asignar"],
    ...["caja.cobrar", "caja.anular"],
  ],
  recepcion: [
    ...["personas.ver", "personas.editar"],
    ...["agenda.ver", "agenda.inscribir"],
    ...["asistencia.ver", "asistencia.avisar", "asistencia.recuperar"],
    ...["abonos.ver", "abonos.asignar"],
    "caja.cobrar",
  ],
  contadora: [
    ...["usuarios.ver", "personas.ver", "agenda.ver", "asistencia.ver"],
    ...["abonos.ver", "caja.ver", "gastos.ver"],
  ],
};

const otras = plantillasDelSistema(CATALOGO).filter((p) => p.plantilla !== "dueno");

describe("plantillas de roles", () => {
  it("lee los permisos de cada llamada, por plantilla", () => {
    const sql = `select identidad_dar_a_plantilla('profesor', array['a.ver', 'a.editar']);
      select identidad_dar_a_plantilla( 'profesor' , ARRAY[ 'b.ver' ]);
      select identidad_dar_a_plantilla('recepcion', array['a.ver']);`;
    const dados = permisosDadosAPlantillas(sql);
    expect(ordenados(dados.get("profesor") ?? [])).toEqual(["a.editar", "a.ver", "b.ver"]);
    expect(ordenados(dados.get("recepcion") ?? [])).toEqual(["a.ver"]);
  });

  it("cada plantilla trae lo acordado", () => {
    const permisos = Object.fromEntries(otras.map((p) => [p.plantilla, ordenados(p.permisos)]));
    const acordado = Object.fromEntries(
      Object.entries(ACORDADO).map(([plantilla, lista]) => [plantilla, ordenados(lista)]),
    );
    expect(permisos).toEqual(acordado);
  });

  it("las migraciones le dan a cada plantilla lo mismo que el código", () => {
    const dados = dadosEnLasMigraciones();
    for (const plantilla of otras) {
      expect(
        ordenados(dados.get(plantilla.plantilla) ?? []),
        `Sumá o corregí select identidad_dar_a_plantilla('${plantilla.plantilla}', array[...])`,
      ).toEqual(ordenados(plantilla.permisos));
    }
  });
});
