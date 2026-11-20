// El tipo de cada profe (0024). Puro. Sin fijar, es empleado.

/** **[SUPUESTO, 0024]** Al socio se le cuentan las clases, pero no se le genera un gasto de sueldo. */
const TIPOS_DE_PROFE = ["empleado", "socio"] as const;
export type TipoDeProfe = (typeof TIPOS_DE_PROFE)[number];

export const TIPO_POR_DEFECTO: TipoDeProfe = "empleado";

export function esTipo(tipo: string): tipo is TipoDeProfe {
  return (TIPOS_DE_PROFE as readonly string[]).includes(tipo);
}
