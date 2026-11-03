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

/** Multiplica y redondea al peso más cercano; ,5 se redondea lejos del cero. */
export function multiplicar(monto: Dinero, factor: number): Dinero {
  if (!Number.isFinite(factor)) {
    throw new RangeError(`El factor ${factor} no es un número finito.`);
  }
  const exacto = monto * factor;
  return pesos(Math.sign(exacto) * Math.round(Math.abs(exacto)));
}
