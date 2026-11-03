// Montos en pesos argentinos enteros. Ver docs/decisiones/0009-montos-en-pesos-enteros.md.
// Es el único lugar del sistema donde se redondea.

declare const marcaDinero: unique symbol;

export type Dinero = number & { readonly [marcaDinero]: true };

export function pesos(monto: number): Dinero {
  if (!Number.isSafeInteger(monto)) {
    throw new RangeError(`El monto ${monto} no es un entero de pesos válido.`);
  }
  return monto as Dinero;
}

export function sumar(a: Dinero, b: Dinero): Dinero {
  return pesos(a + b);
}

export function restar(a: Dinero, b: Dinero): Dinero {
  return pesos(a - b);
}

/**
 * Multiplica por la fracción numerador/denominador y redondea al peso más cercano; ,5 se
 * redondea lejos del cero. El factor es una fracción de enteros (15 % = 15/100) y el cálculo
 * se hace con bigint: un decimal de punto flotante corre los empates (0,29 × 50 = 14,4999…).
 */
export function multiplicar(monto: Dinero, numerador: number, denominador = 1): Dinero {
  if (!Number.isSafeInteger(numerador) || !Number.isSafeInteger(denominador) || denominador <= 0) {
    throw new RangeError(
      `El factor ${numerador}/${denominador} no es una fracción de enteros con denominador positivo.`,
    );
  }
  const producto = BigInt(monto) * BigInt(numerador);
  const divisor = BigInt(denominador);
  const absoluto = producto < 0n ? -producto : producto;
  const redondeado = (2n * absoluto + divisor) / (2n * divisor);
  const resultado = producto < 0n ? -redondeado : redondeado;
  if (resultado > BigInt(Number.MAX_SAFE_INTEGER) || resultado < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`El resultado ${resultado} no es un entero de pesos válido.`);
  }
  return pesos(Number(resultado));
}
