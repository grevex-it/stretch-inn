// Muchos logins a la vez contra el mismo email no pasan todos el límite de intentos (0017).
// Con dobles: lo que importa es cuántas claves se llegan a verificar.
import { describe, expect, it, vi } from "vitest";
import { entrar, type DependenciasAcceso } from "../src/aplicacion/acceso.ts";
import type { RepositorioAcceso } from "../src/aplicacion/puertos-acceso.ts";
import { crearLimiteDeIntentos } from "../src/dominio/intentos.ts";

function dependencias(verificar: DependenciasAcceso["claves"]["verificar"]): DependenciasAcceso {
  const repo: Partial<RepositorioAcceso> = {
    cuentaPorEmail: () =>
      Promise.resolve({ id: "cuenta", hashClave: "hash", debeCambiarClave: false }),
  };
  return {
    repo: repo as RepositorioAcceso,
    claves: {
      verificar,
      hashear: () => Promise.resolve(""),
      nuevoToken: () => "",
      hashDeToken: () => "",
    },
    limite: crearLimiteDeIntentos(),
    ahora: () => new Date("2026-11-05T10:00:00Z"),
    hashDeRelleno: Promise.resolve("relleno"),
  };
}

const datos = { email: "ana@ejemplo.com", clave: "mal", origen: "10.0.0.1" };

describe("entrar con intentos simultáneos", () => {
  it("de 20 intentos lanzados a la vez, solo 5 llegan a verificar la clave", async () => {
    const verificar = vi.fn(
      () =>
        new Promise<boolean>((resolver) => {
          setTimeout(() => {
            resolver(false);
          }, 10);
        }),
    );
    const deps = dependencias(verificar);
    const resultados = await Promise.all(Array.from({ length: 20 }, () => entrar(deps, datos)));
    expect(verificar).toHaveBeenCalledTimes(5);
    expect(resultados.every((r) => !r.ok)).toBe(true);
  });

  it("si la verificación falla por un error, libera el lugar y no cuenta como fallo", async () => {
    const deps = dependencias(() => Promise.reject(new Error("se cayó la base")));
    for (let i = 0; i < 6; i++) await expect(entrar(deps, datos)).rejects.toThrow("se cayó");
    expect(deps.limite.intentar(datos, deps.ahora())).toBe(true);
  });
});
