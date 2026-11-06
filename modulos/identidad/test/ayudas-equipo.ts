// Datos y sesiones de prueba para los tests del equipo. El contexto sale siempre de una sesión
// real (regla 1 de AGENTS.md): nunca se arma a mano.
import { id, type ContextoCentro } from "@app/nucleo";
import { randomUUID } from "node:crypto";
import type { Acceso, SesionResuelta } from "../src/index.ts";
import { CLAVE, centroConSedes, cuenta, rolCon, usuario } from "./ayudas-acceso.ts";

const GESTION = ["usuarios.ver", "usuarios.gestionar", "roles.gestionar"];

/**
 * Un centro con las sedes Norte y Sur, los roles Dueño (gestión y caja.ver) y Recepción
 * (caja.ver), y un admin con Dueño en las dos sedes.
 */
export async function centroConEquipo(nombre = "Centro") {
  const centro = await centroConSedes(nombre, ["Norte", "Sur"]);
  const [norte, sur] = centro.sedeIds as [string, string];
  const duenio = await rolCon(centro.centroId, "Dueño", [...GESTION, "caja.ver"]);
  const admin = await cuenta();
  const adminId = await usuario(admin.cuentaId, { ...centro, rolId: duenio }, [norte, sur]);
  return {
    centroId: centro.centroId,
    norte,
    sur,
    recepcion: centro.rolId,
    duenio,
    admin: { ...admin, usuarioId: adminId },
  };
}

export type CentroDePrueba = Awaited<ReturnType<typeof centroConEquipo>>;

/** Una persona del centro con ese rol en esas sedes. */
export async function integrante(c: CentroDePrueba, rolId: string, sedeIds: string[]) {
  const datos = await cuenta();
  const usuarioId = await usuario(datos.cuentaId, { centroId: c.centroId, rolId }, sedeIds);
  return { ...datos, usuarioId };
}

/** Entra con email y clave; con `sede`, la elige. Cada ingreso con un origen propio. */
export async function entrarComo(
  acceso: Acceso,
  email: string,
  opciones: { clave?: string; sede?: string } = {},
): Promise<{ token: string; sesion: SesionResuelta }> {
  const ingreso = await acceso.entrar({
    email,
    clave: opciones.clave ?? CLAVE,
    origen: randomUUID(),
  });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const { token } = ingreso.valor;
  let sesion = await acceso.resolver(token);
  if (sesion !== undefined && opciones.sede !== undefined) {
    await acceso.elegirSede(sesion, id<"Sede">(opciones.sede));
    sesion = await acceso.resolver(token);
  }
  if (sesion === undefined) throw new Error("La sesión no se resolvió.");
  return { token, sesion };
}

export function contextoDe(sesion: SesionResuelta): ContextoCentro {
  if (sesion.centro === null) throw new Error("La sesión no tiene centro.");
  return sesion.centro.contexto;
}

/** El contexto real del admin del centro, como lo arma la API en cada pedido. */
export async function comoAdmin(acceso: Acceso, c: CentroDePrueba, sede?: string) {
  const opciones = sede === undefined ? {} : { sede };
  return contextoDe((await entrarComo(acceso, c.admin.email, opciones)).sesion);
}
