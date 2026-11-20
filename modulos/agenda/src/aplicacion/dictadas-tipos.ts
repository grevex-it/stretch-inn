// Las clases dictadas por los profes (0022, 0024): lo que devuelven el reporte y dictadasPorDia.

/** Las clases que dio un profe (o las sin profe, con null) en un día. */
export interface DictadasDelDia {
  /** AAAA-MM-DD, en la zona del centro. */
  fecha: string;
  profeId: string | null;
  clases: number;
}

/** Las clases dictadas por cada profe en un período (0022), y las de clases sin profe. */
export interface ClasesDictadas {
  /** Por profe: el que más clases dio primero y, si empatan, por nombre. */
  profes: { profeId: string; nombre: string; clases: number }[];
  sinProfe: number;
}
