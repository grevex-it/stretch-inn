// Límite de intentos de login (ver docs/decisiones/0017): 5 fallidos en 15 minutos por email y
// por origen bloquean ese par 15 minutos. Vive en memoria del proceso mientras haya una sola
// instancia de la API (0013).

const MINUTO = 60 * 1000;

interface ParDeIntento {
  email: string;
  origen: string;
}

export interface OpcionesLimite {
  maximoDeFallos?: number;
  ventanaMs?: number;
  bloqueoMs?: number;
  /** Al superarlo se descartan los pares vencidos, para que la memoria no crezca sin límite. */
  maximoDePares?: number;
}

export interface LimiteDeIntentos {
  bloqueado(par: ParDeIntento, ahora: Date): boolean;
  registrarFallo(par: ParDeIntento, ahora: Date): void;
  /** Un ingreso correcto borra los fallos del par. */
  limpiar(par: ParDeIntento): void;
  paresGuardados(): number;
}

interface Registro {
  fallos: number[];
  bloqueadoHasta: number;
}

const clave = ({ email, origen }: ParDeIntento) => `${email.trim().toLowerCase()}|${origen}`;

export function crearLimiteDeIntentos({
  maximoDeFallos = 5,
  ventanaMs = 15 * MINUTO,
  bloqueoMs = 15 * MINUTO,
  maximoDePares = 10_000,
}: OpcionesLimite = {}): LimiteDeIntentos {
  const registros = new Map<string, Registro>();
  const vencido = (registro: Registro, ahora: number) =>
    registro.bloqueadoHasta <= ahora && registro.fallos.every((t) => ahora - t >= ventanaMs);

  function descartarVencidos(ahora: number): void {
    for (const [par, registro] of registros) {
      if (vencido(registro, ahora)) registros.delete(par);
    }
  }

  return {
    bloqueado: (par, ahora) => (registros.get(clave(par))?.bloqueadoHasta ?? 0) > ahora.getTime(),
    registrarFallo(par, ahora) {
      const t = ahora.getTime();
      if (registros.size >= maximoDePares) descartarVencidos(t);
      const registro = registros.get(clave(par)) ?? { fallos: [], bloqueadoHasta: 0 };
      registro.fallos = [...registro.fallos.filter((f) => t - f < ventanaMs), t];
      if (registro.fallos.length >= maximoDeFallos) {
        registro.bloqueadoHasta = t + bloqueoMs;
        registro.fallos = [];
      }
      registros.set(clave(par), registro);
    },
    limpiar: (par) => registros.delete(clave(par)),
    paresGuardados: () => registros.size,
  };
}
