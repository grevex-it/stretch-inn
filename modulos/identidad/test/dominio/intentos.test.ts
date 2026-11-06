// Límite de intentos de login de la 0017: 5 fallidos en 15 minutos bloquean el par email y
// origen por 15 minutos. Cada intento reserva su lugar antes de verificar la clave, para que
// muchos intentos a la vez no pasen todos el control. Unitarios, sin base.
import { describe, expect, it } from "vitest";
import { crearLimiteDeIntentos } from "../../src/dominio/intentos.ts";

const MINUTO = 60 * 1000;
const inicio = new Date("2026-11-05T10:00:00Z").getTime();
const en = (minutos: number) => new Date(inicio + minutos * MINUTO);
const ana = { email: "ana@ejemplo.com", origen: "10.0.0.1" };

type Limite = ReturnType<typeof crearLimiteDeIntentos>;

/** Intentos que fallan, uno detrás del otro. */
function fallar(limite: Limite, veces: number, minuto = 0) {
  for (let i = 0; i < veces; i++) {
    expect(limite.intentar(ana, en(minuto))).toBe(true);
    limite.registrarFallo(ana, en(minuto));
  }
}

describe("crearLimiteDeIntentos", () => {
  it("4 fallos dejan intentar; después del 5.º, no", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4);
    fallar(limite, 1, 1);
    expect(limite.intentar(ana, en(1))).toBe(false);
  });

  it("el bloqueo dura 15 minutos desde el 5.º fallo", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5, 2);
    expect(limite.intentar(ana, en(16.99))).toBe(false);
    expect(limite.intentar(ana, en(17))).toBe(true);
  });

  it("los fallos de hace más de 15 minutos no cuentan", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4, 0);
    fallar(limite, 1, 15);
    expect(limite.intentar(ana, en(15))).toBe(true);
  });

  it("muchos intentos a la vez: solo 5 quedan en curso, el resto se rechaza", () => {
    const limite = crearLimiteDeIntentos();
    const aceptados = Array.from({ length: 20 }, () => limite.intentar(ana, en(0)));
    expect(aceptados.filter(Boolean)).toHaveLength(5);
  });

  it("un intento en curso que termina libera su lugar", () => {
    const limite = crearLimiteDeIntentos();
    for (let i = 0; i < 5; i++) limite.intentar(ana, en(0));
    expect(limite.intentar(ana, en(0))).toBe(false);
    limite.liberar(ana);
    expect(limite.intentar(ana, en(0))).toBe(true);
  });

  it("bloquea el par: el mismo email desde otro origen sigue pudiendo intentar", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5);
    expect(limite.intentar({ ...ana, origen: "10.0.0.2" }, en(1))).toBe(true);
  });

  it("el email no distingue mayúsculas", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 5);
    expect(limite.intentar({ ...ana, email: "ANA@ejemplo.com" }, en(1))).toBe(false);
  });

  it("un ingreso correcto borra los fallos anteriores", () => {
    const limite = crearLimiteDeIntentos();
    fallar(limite, 4);
    limite.intentar(ana, en(1));
    limite.registrarExito(ana);
    fallar(limite, 4, 1);
    expect(limite.intentar(ana, en(1))).toBe(true);
  });

  it("descarta los pares vencidos para no crecer sin límite", () => {
    const limite = crearLimiteDeIntentos({ maximoDePares: 2 });
    for (const email of ["a@x", "b@x"]) {
      limite.intentar({ email, origen: "1" }, en(0));
      limite.registrarFallo({ email, origen: "1" }, en(0));
    }
    limite.intentar({ email: "c@x", origen: "1" }, en(31));
    expect(limite.paresGuardados()).toBe(1);
  });
});
