// Límite de intentos de login (ver docs/decisiones/0017): 5 fallidos en 15 minutos por email y
// por origen bloquean ese par 15 minutos. Vive en memoria del proceso mientras haya una sola
// instancia de la API (0013).
//
// Cada intento reserva su lugar antes de verificar la clave (`intentar`), en el mismo paso que
// el control: si no, muchos intentos lanzados a la vez pasarían todos antes del primer fallo.

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
  /** Reserva un intento. false si está bloqueado o si fallos + en curso ya llegan al máximo. */
  intentar(par: ParDeIntento, ahora: Date): boolean;
  /** El intento reservado falló: cuenta como fallo y puede bloquear el par. */
  registrarFallo(par: ParDeIntento, ahora: Date): void;
  /** El intento reservado entró: se borran los fallos del par. */
  registrarExito(par: ParDeIntento): void;
  /** El intento reservado no llegó a verificarse (un error): libera su lugar sin contar. */
  liberar(par: ParDeIntento): void;
  paresGuardados(): number;
}

interface Registro {
  fallos: number[];
  enCurso: number;
  bloqueadoHasta: number;
}

const clave = ({ email, origen }: ParDeIntento) => `${email.trim().toLowerCase()}|${origen}`;
const nuevo = (): Registro => ({ fallos: [], enCurso: 0, bloqueadoHasta: 0 });

type Configuracion = Required<OpcionesLimite>;

/** Los registros de todos los pares, con las reglas de vencimiento. */
function crearRegistros(config: Configuracion) {
  const registros = new Map<string, Registro>();
  const vigentes = (registro: Registro, ahora: number) =>
    registro.fallos.filter((f) => ahora - f < config.ventanaMs);
  const vencido = (registro: Registro, ahora: number) =>
    registro.enCurso === 0 &&
    registro.bloqueadoHasta <= ahora &&
    vigentes(registro, ahora).length === 0;
  return {
    mapa: registros,
    vigentes,
    descartarVencidos(ahora: number): void {
      for (const [par, registro] of registros) {
        if (vencido(registro, ahora)) registros.delete(par);
      }
    },
    /** Cierra el intento en curso del par. */
    terminar(par: ParDeIntento): Registro | undefined {
      const registro = registros.get(clave(par));
      if (registro !== undefined) registro.enCurso = Math.max(0, registro.enCurso - 1);
      return registro;
    },
  };
}

export function crearLimiteDeIntentos(opciones: OpcionesLimite = {}): LimiteDeIntentos {
  const config: Configuracion = {
    maximoDeFallos: 5,
    ventanaMs: 15 * MINUTO,
    bloqueoMs: 15 * MINUTO,
    maximoDePares: 10_000,
    ...opciones,
  };
  const registros = crearRegistros(config);
  const { mapa, vigentes } = registros;
  return {
    intentar(par, ahora) {
      const t = ahora.getTime();
      if (mapa.size >= config.maximoDePares) registros.descartarVencidos(t);
      const registro = mapa.get(clave(par)) ?? nuevo();
      registro.fallos = vigentes(registro, t);
      if (registro.bloqueadoHasta > t) return false;
      if (registro.fallos.length + registro.enCurso >= config.maximoDeFallos) return false;
      registro.enCurso += 1;
      mapa.set(clave(par), registro);
      return true;
    },
    registrarFallo(par, ahora) {
      const t = ahora.getTime();
      const registro = registros.terminar(par) ?? nuevo();
      registro.fallos = [...vigentes(registro, t), t];
      if (registro.fallos.length >= config.maximoDeFallos) {
        registro.bloqueadoHasta = t + config.bloqueoMs;
        registro.fallos = [];
      }
      mapa.set(clave(par), registro);
    },
    registrarExito(par) {
      const registro = registros.terminar(par);
      if (registro === undefined) return;
      if (registro.enCurso === 0) mapa.delete(clave(par));
      else registro.fallos = [];
    },
    liberar(par) {
      registros.terminar(par);
    },
    paresGuardados: () => mapa.size,
  };
}
