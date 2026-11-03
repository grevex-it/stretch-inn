// Resultado de una regla de negocio. Una falla esperada («el cupo está lleno») no es un
// error del sistema: se le responde al usuario con su mensaje (ver 0016).

export interface Falla<Codigo extends string = string> {
  readonly codigo: Codigo;
  readonly mensaje: string;
}

export type Resultado<Valor, Codigo extends string = string> =
  | { readonly ok: true; readonly valor: Valor }
  | { readonly ok: false; readonly error: Falla<Codigo> };

export function ok<Valor>(valor: Valor): Resultado<Valor, never> {
  return { ok: true, valor };
}

export function falla<Codigo extends string>(
  codigo: Codigo,
  mensaje: string,
): Resultado<never, Codigo> {
  return { ok: false, error: { codigo, mensaje } };
}
