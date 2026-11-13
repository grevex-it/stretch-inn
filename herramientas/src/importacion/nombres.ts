// Separar la columna «Nombre y apellido» de la planilla de Stretch Inn (0022). Puro. La primera
// palabra es nombre; las siguientes también, mientras sean nombres de pila conocidos; el resto es
// apellido. No es seguro: con tres palabras o más, el resultado se marca para revisar.

/** Nombres de pila frecuentes, en mayúsculas y sin tildes. */
const NOMBRES = new Set(
  (
    "MARIA FERNANDA ALEJANDRA BELEN JOSE LUIS ANA PAULA LAURA SOFIA CECILIA ELENA INES ISABEL " +
    "CARMEN ROSA SUSANA BEATRIZ VICTORIA GABRIELA ANDREA SILVIA PATRICIA VERONICA MARCELA NATALIA " +
    "LUCIA EUGENIA FLORENCIA SOLEDAD VALERIA CAROLINA JULIETA GRACIELA MONICA ALICIA NORMA MARTA " +
    "MIRTA ESTER ESTHER CRISTINA TERESA GUADALUPE MERCEDES JUAN CARLOS PABLO MIGUEL ANGEL ANTONIO " +
    "MANUEL ALBERTO DANIEL JORGE RAUL RICARDO EDUARDO FRANCISCO JAVIER MARTIN SEBASTIAN ALEJANDRO " +
    "FERNANDO GUSTAVO ROBERTO OSCAR HECTOR MARIO SERGIO DIEGO LUCAS NICOLAS AGUSTIN IGNACIO MATIAS " +
    "TOMAS ESTEBAN ANDRES LORENA ADRIANA ROXANA SANDRA CLAUDIA LILIANA VIVIANA ELISA ELIZABETH " +
    "NOEMI NANCY GLADYS MIRIAM DANIELA MARIELA ROMINA VANESA VANESSA ANALIA CELESTE AGUSTINA " +
    "MICAELA CAMILA ANTONELLA MELINA MILAGROS ROCIO JIMENA LUJAN PILAR MAGDALENA JOSEFINA CATALINA " +
    "VIRGINIA EMILIA RAQUEL OLGA IRMA AMALIA DORA NELIDA NILDA HAYDEE LIDIA BLANCA ESTELA GRISELDA " +
    "REBECA REBECCA JESUS JULIA NOELIA YANINA SABRINA EVANGELINA MARISA MARISOL GISELA GISELLE LIA OSMAR"
  ).split(" "),
);

/** Nombres compuestos con partícula: «María del Carmen», «Ana de los Ángeles». */
const COMPUESTOS = [
  ["DEL", "CARMEN"],
  ["DEL", "VALLE"],
  ["DEL", "ROSARIO"],
  ["DEL", "PILAR"],
  ["DE", "LOS", "ANGELES"],
  ["DE", "LAS", "MERCEDES"],
  ["DE", "JESUS"],
  ["DE", "LOURDES"],
  ["DE", "FATIMA"],
];

/** Van con el apellido y en minúscula: «de la Fuente». */
const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "DI", "DA", "VAN", "VON"]);

const sinTildes = (palabra: string) =>
  palabra
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

function capitalizar(palabra: string): string {
  if (PARTICULAS.has(sinTildes(palabra))) return palabra.toLocaleLowerCase("es-AR");
  const minuscula = palabra.toLocaleLowerCase("es-AR");
  return minuscula.charAt(0).toLocaleUpperCase("es-AR") + minuscula.slice(1);
}

export function separarNombre(completo: string): {
  nombre: string;
  apellido: string;
  revisar: boolean;
} {
  const palabras = completo.trim().split(/\s+/).filter(Boolean).map(capitalizar);
  const claves = palabras.map(sinTildes);
  let deNombre = 1;
  // Queda al menos una palabra para el apellido; una partícula ya es apellido, salvo en un nombre
  // compuesto.
  while (deNombre < palabras.length - 1) {
    const desde = deNombre;
    const compuesto = COMPUESTOS.find(
      (partes) =>
        desde + partes.length < palabras.length &&
        partes.every((parte, i) => claves[desde + i] === parte),
    );
    if (compuesto !== undefined) deNombre += compuesto.length;
    else if (NOMBRES.has(claves[deNombre] ?? "")) deNombre++;
    else break;
  }
  return {
    nombre: palabras.slice(0, deNombre).join(" "),
    apellido: palabras.slice(deNombre).join(" "),
    revisar: palabras.length !== 2,
  };
}
