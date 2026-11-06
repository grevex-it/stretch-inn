// Hash de contraseñas con scrypt y tokens de sesión (ver docs/decisiones/0017).
import { describe, expect, it } from "vitest";
import {
  hashDeToken,
  hashearClave,
  nuevoToken,
  verificarClave,
} from "../src/infraestructura/claves.ts";

describe("hashearClave y verificarClave", () => {
  it("verifica la clave correcta y rechaza otra", async () => {
    const hash = await hashearClave("una clave larga");
    await expect(verificarClave("una clave larga", hash)).resolves.toBe(true);
    await expect(verificarClave("una clave largA", hash)).resolves.toBe(false);
  });

  it("guarda los parámetros junto al hash y usa una sal propia cada vez", async () => {
    const [a, b] = await Promise.all([hashearClave("misma clave"), hashearClave("misma clave")]);
    expect(a).toMatch(/^scrypt\$N=\d+,r=\d+,p=\d+\$[\w-]+\$[\w-]+$/);
    expect(a).not.toBe(b);
  });

  it("verifica un hash hecho con otros parámetros: se pueden subir sin invalidar los viejos", async () => {
    const viejo = await hashearClave("clave de antes", { N: 1024, r: 8, p: 1 });
    expect(viejo).toContain("N=1024");
    await expect(verificarClave("clave de antes", viejo)).resolves.toBe(true);
  });

  it("un hash mal formado no verifica nada, ni tira error", async () => {
    await expect(verificarClave("x", "x")).resolves.toBe(false);
    await expect(verificarClave("x", "scrypt$N=abc$$")).resolves.toBe(false);
  });
});

describe("tokens de sesión", () => {
  it("son de 32 bytes aleatorios y no se repiten", () => {
    const a = nuevoToken();
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(nuevoToken()).not.toBe(a);
  });

  it("en la base se guarda un hash que no es el token", () => {
    const token = nuevoToken();
    expect(hashDeToken(token)).not.toBe(token);
    expect(hashDeToken(token)).toBe(hashDeToken(token));
  });
});
