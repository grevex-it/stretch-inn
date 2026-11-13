// El cliente HTTP del importador (0022): entra a la API con un usuario real del centro y usa las
// mismas rutas que el panel. Así la carga pasa por los permisos y las reglas de siempre, y nunca
// se arma un contexto a mano (regla 1).
import { alumnoCreado, paginaDeAlumnos, paginaDeEquipo } from "@app/contratos";
import type { z } from "zod";
import { normalizarNombre, type ApiDeCarga } from "./cargar.ts";

export interface Acceso {
  /** La URL de la API, sin barra final: `https://api.dominio`. */
  url: string;
  email: string;
  clave: string;
  /** El origen del panel (`ORIGEN_PANEL` de la API): el único que acepta para cambiar datos. */
  origen: string;
  /** El centro, si el usuario tiene más de uno. */
  centroId?: string;
}

type Pedir = (metodo: string, ruta: string, cuerpo?: unknown) => Promise<Response>;

async function mensajeDe(respuesta: Response): Promise<string> {
  const cuerpo = (await respuesta.json().catch(() => null)) as {
    error?: { mensaje?: string };
  } | null;
  return cuerpo?.error?.mensaje ?? `La API respondió ${String(respuesta.status)}.`;
}

async function leer<T>(respuesta: Response, esquema: z.ZodType<T>): Promise<T> {
  if (!respuesta.ok) throw new Error(await mensajeDe(respuesta));
  return esquema.parse(await respuesta.json());
}

/** Entra con email y clave y elige el centro: devuelve el pedido con la cookie de la sesión. */
async function entrar(acceso: Acceso, buscar: typeof fetch): Promise<Pedir> {
  const ingreso = await buscar(`${acceso.url}/sesion`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: acceso.origen },
    body: JSON.stringify({ email: acceso.email, clave: acceso.clave }),
  });
  if (!ingreso.ok) throw new Error(await mensajeDe(ingreso));
  const cookie = (ingreso.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const { centros } = (await ingreso.json()) as { centros: { id: string }[] };
  const pedir: Pedir = (metodo, ruta, cuerpo) =>
    buscar(`${acceso.url}${ruta}`, {
      method: metodo,
      headers: {
        cookie,
        origin: acceso.origen,
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  const centroId = acceso.centroId ?? (centros.length === 1 ? centros[0]?.id : undefined);
  if (centroId === undefined) throw new Error("Elegí el centro: el usuario tiene más de uno.");
  const eleccion = await pedir("PUT", "/sesion/centro", { centroId });
  if (!eleccion.ok) throw new Error(await mensajeDe(eleccion));
  return pedir;
}

/** Los integrantes del equipo, de todas las páginas: nombre normalizado → id. */
async function profes(pedir: Pedir): Promise<Map<string, string>> {
  const nombres = new Map<string, string>();
  for (let numero = 1; ; numero++) {
    const pagina = await leer(
      await pedir("GET", `/equipo?pagina=${String(numero)}`),
      paginaDeEquipo,
    );
    for (const integrante of pagina.elementos) {
      nombres.set(normalizarNombre(integrante.nombre), integrante.id);
    }
    if (numero * pagina.porPagina >= pagina.total) return nombres;
  }
}

/** Busca el número de socio, también entre las bajas, página por página hasta encontrarlo. */
async function existe(pedir: Pedir, numeroDeSocio: number): Promise<boolean> {
  for (let numero = 1; ; numero++) {
    const ruta = `/alumnos?buscar=${String(numeroDeSocio)}&bajas=si&pagina=${String(numero)}`;
    const pagina = await leer(await pedir("GET", ruta), paginaDeAlumnos);
    if (pagina.elementos.some((a) => a.numeroDeSocio === numeroDeSocio)) return true;
    if (numero * pagina.porPagina >= pagina.total) return false;
  }
}

export async function entrarALaApi(
  acceso: Acceso,
  buscar: typeof fetch = fetch,
): Promise<ApiDeCarga> {
  const pedir = await entrar(acceso, buscar);
  return {
    profes: () => profes(pedir),
    existe: (numeroDeSocio) => existe(pedir, numeroDeSocio),
    async crear(ficha) {
      const respuesta = await pedir("POST", "/alumnos", ficha);
      if (!respuesta.ok) return { ok: false, mensaje: await mensajeDe(respuesta) };
      return { ok: true, id: alumnoCreado.parse(await respuesta.json()).id };
    },
    async guardarSalud(id, patologias) {
      const respuesta = await pedir("PUT", `/alumnos/${id}/salud`, { patologias, version: 0 });
      if (!respuesta.ok) throw new Error(await mensajeDe(respuesta));
    },
    async darDeBaja(id) {
      const respuesta = await pedir("PUT", `/alumnos/${id}/baja`);
      if (!respuesta.ok) throw new Error(await mensajeDe(respuesta));
    },
  };
}
