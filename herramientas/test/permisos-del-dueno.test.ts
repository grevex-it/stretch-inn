// Guardián: todo permiso del catálogo llega por migración al Dueño de los centros que ya existen.
// Sin esto, al sumar un módulo nadie del centro tiene sus permisos, ni puede darlos (0007).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO } from "../src/catalogo.ts";

const MIGRACIONES = join(import.meta.dirname, "..", "..", "db", "migraciones");

/** Los permisos que alguna migración le da al Dueño con identidad_dar_al_dueno(array[...]). */
export function permisosDadosAlDueno(sql: string): string[] {
  const llamadas = sql.matchAll(/identidad_dar_al_dueno\s*\(\s*array\s*\[([^\]]*)\]/gi);
  return [...llamadas].flatMap(([, lista]) =>
    [...(lista ?? "").matchAll(/'([^']+)'/g)].map(([, permiso]) => permiso ?? ""),
  );
}

describe("permisos del Dueño", () => {
  it("lee los permisos de cada llamada en una migración", () => {
    const sql = `select identidad_dar_al_dueno(array['a.ver', 'a.editar']);
      select identidad_dar_al_dueno(ARRAY[ 'b.ver' ]);`;
    expect(permisosDadosAlDueno(sql)).toEqual(["a.ver", "a.editar", "b.ver"]);
  });

  it("cada permiso del catálogo se le da al Dueño en alguna migración", () => {
    const dados = new Set(
      readdirSync(MIGRACIONES)
        .filter((archivo) => archivo.endsWith(".sql"))
        .flatMap((archivo) =>
          permisosDadosAlDueno(readFileSync(join(MIGRACIONES, archivo), "utf8")),
        ),
    );
    const faltan = CATALOGO.todos.filter((permiso) => !dados.has(permiso));
    expect(faltan, "Sumá una migración con select identidad_dar_al_dueno(array[...])").toEqual([]);
  });
});
