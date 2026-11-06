// Límite de intentos de login de la 0017: 5 fallidos en 15 minutos bloquean el par email y
// origen por 15 minutos. Unitarios, sin base.
import { describe, expect, it } from "vitest";
import { crearLimiteDeIntentos } from "../../src/dominio/intentos.ts";

const MINUTO = 60 * 1000;
const inicio = new Date("2026-11-05T10:00:00Z").getTime();
const en = (minutos: number) => new Date(inicio + minutos * MINUTO);
const ana = { email: "ana@ejemplo.com", origen: "10.0.0.1" };

function fallar(limite: ReturnType<typeof crearLimiteDeIntentos>, veces: number, minuto = 0) {
  for (let i = 0; i < veces; i++) limite.registrarFallo(ana, en(minuto));
}

describe("crearLimiteDeIntentos", () => {
  it("4 fallos no bloquean; el 5.º sí", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4);
    expect(limite.bloqueado(ana, en(1))).toBe(false);
    fallar(limite, 1, 1);
    expect(limite.bloqueado(ana, en(1))).toBe(true);
  });

  it("el bloqueo dura 15 minutos desde el 5.º fallo", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5, 2);
    expect(limite.bloqueado(ana, en(16.99))).toBe(true);
    expect(limite.bloqueado(ana, en(17))).toBe(false);
  });

  it("los fallos de hace más de 15 minutos no cuentan", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4, 0);
    fallar(limite, 1, 15);
    expect(limite.bloqueado(ana, en(15))).toBe(false);
  });

  it("bloquea el par: el mismo email desde otro origen sigue pudiendo entrar", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5);
    expect(limite.bloqueado({ ...ana, origen: "10.0.0.2" }, en(1))).toBe(false);
  });

  it("el email no distingue mayúsculas", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5);
    expect(limite.bloqueado({ ...ana, email: "ANA@ejemplo.com" }, en(1))).toBe(true);
  });

  it("un ingreso correcto borra los fallos anteriores", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4);
    limite.limpiar(ana);
    fallar(limite, 1, 1);
    expect(limite.bloqueado(ana, en(1))).toBe(false);
  });

  it("descarta los pares vencidos para no crecer sin límite", () => {
    const limite = crearLimiteDeIntentos({ maximoDePares: 2 });
    limite.registrarFallo({ email: "a@x", origen: "1" }, en(0));
    limite.registrarFallo({ email: "b@x", origen: "1" }, en(0));
    limite.registrarFallo({ email: "c@x", origen: "1" }, en(31));
    expect(limite.paresGuardados()).toBe(1);
  });
});
