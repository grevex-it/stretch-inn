// Contraseñas y tokens de sesión (ver docs/decisiones/0017). scrypt viene con Node; los
// parámetros se guardan junto al hash para poder subirlos sin invalidar los existentes.
import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

export interface ParametrosScrypt {
  N: number;
  r: number;
  p: number;
}

const PARAMETROS: ParametrosScrypt = { N: 2 ** 15, r: 8, p: 1 };
const LARGO_DEL_HASH = 64;
const FORMATO = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/;

function derivar(clave: string, sal: Buffer, { N, r, p }: ParametrosScrypt): Promise<Buffer> {
  // scrypt usa 128 × N × r bytes: se deja margen sobre el límite por defecto de Node (32 MiB).
  const opciones: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolver, rechazar) => {
    scrypt(clave.normalize("NFC"), sal, LARGO_DEL_HASH, opciones, (error, derivada) => {
      if (error === null) resolver(derivada);
      else rechazar(error);
    });
  });
}

/** Devuelve `scrypt$N=…,r=…,p=…$sal$hash`, en base64url. */
export async function hashearClave(
  clave: string,
  parametros: ParametrosScrypt = PARAMETROS,
): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(clave, sal, parametros);
  const { N, r, p } = parametros;
  return `scrypt$N=${String(N)},r=${String(r)},p=${String(p)}$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Compara en tiempo constante. Un hash mal formado no verifica nada. */
export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [, N, r, p, sal, hash] = FORMATO.exec(guardado) ?? [];
  if (N === undefined || r === undefined || p === undefined) return false;
  if (sal === undefined || hash === undefined) return false;
  const esperado = Buffer.from(hash, "base64url");
  try {
    const derivada = await derivar(clave, Buffer.from(sal, "base64url"), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return esperado.length === derivada.length && timingSafeEqual(esperado, derivada);
  } catch {
    // Parámetros inválidos guardados (N que no es potencia de 2, por ejemplo).
    return false;
  }
}

/** Token de sesión: 32 bytes aleatorios. Viaja solo en la cookie. */
export function nuevoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Sin i, l, o, 0 ni 1: se confunden al dictarla. */
const LETRAS_TEMPORALES = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Clave temporal del alta y del reset, para dictar o copiar: 3 grupos de 4 (unos 59 bits). Sirve
 * solo para entrar una vez y cambiarla, y el login tiene límite de intentos.
 */
export function claveTemporal(): string {
  const grupos = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => LETRAS_TEMPORALES[randomInt(LETRAS_TEMPORALES.length)]).join(
      "",
    ),
  );
  return grupos.join("-");
}

/** Lo que se guarda en la base: si se filtra la tabla, no sirve para entrar. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
