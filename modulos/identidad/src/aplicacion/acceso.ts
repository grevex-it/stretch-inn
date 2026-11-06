// Login, sesiones, centro y sede activa (ver docs/decisiones/0017).
import { falla, id, ok, type Resultado } from "@app/nucleo";
import type { LimiteDeIntentos } from "../dominio/intentos.ts";
import {
  elegirSedeActiva,
  permisosDeLaSedeActiva,
  sedesConPermisos,
  sesionVigente,
  validarClaveNueva,
  type SedeActiva,
} from "../dominio/sesion.ts";
import { efectivosDe } from "./casos-de-uso.ts";
import type {
  CentroActivo,
  Claves,
  CuentaGuardada,
  ErrorDeCentro,
  ErrorDeClave,
  ErrorDeIngreso,
  ErrorDeSede,
  Ingreso,
  RepositorioAcceso,
  SesionGuardada,
  SesionResuelta,
} from "./puertos-acceso.ts";

export interface DependenciasAcceso {
  repo: RepositorioAcceso;
  claves: Claves;
  limite: LimiteDeIntentos;
  ahora: () => Date;
  /** Hash de una clave cualquiera: si el email no existe se verifica igual, y tarda lo mismo. */
  hashDeRelleno: Promise<string>;
}

const INCORRECTAS = falla("credenciales-incorrectas", "Email o contraseña incorrectos.");

/** La cuenta si la clave es correcta. Con un email que no existe verifica igual, contra el relleno. */
async function verificarCredenciales(
  deps: DependenciasAcceso,
  email: string,
  clave: string,
): Promise<CuentaGuardada | undefined> {
  const cuenta = await deps.repo.cuentaPorEmail(email.trim());
  const hash = cuenta?.hashClave ?? (await deps.hashDeRelleno);
  const valida = await deps.claves.verificar(clave, hash);
  return valida ? cuenta : undefined;
}

export async function entrar(
  deps: DependenciasAcceso,
  { email, clave, origen }: { email: string; clave: string; origen: string },
): Promise<Resultado<Ingreso, ErrorDeIngreso>> {
  const par = { email, origen };
  // Se reserva el intento antes de cualquier espera: ver dominio/intentos.ts.
  if (!deps.limite.intentar(par, deps.ahora())) return INCORRECTAS;
  const cuenta = await verificarCredenciales(deps, email, clave).catch((error: unknown) => {
    deps.limite.liberar(par);
    throw error;
  });
  if (cuenta === undefined) {
    deps.limite.registrarFallo(par, deps.ahora());
    return INCORRECTAS;
  }
  deps.limite.registrarExito(par);
  const token = deps.claves.nuevoToken();
  const sesionId = await deps.repo.crearSesion({
    hashToken: deps.claves.hashDeToken(token),
    cuentaId: cuenta.id,
    ahora: deps.ahora(),
  });
  const centros = await deps.repo.centrosDe(cuenta.id);
  const [unico] = centros;
  if (centros.length === 1 && unico !== undefined) {
    await fijarCentro(deps.repo, sesionId, cuenta.id, unico);
  }
  return ok({
    token,
    debeCambiarClave: cuenta.debeCambiarClave,
    centros: centros.map(({ centroId, nombre }) => ({ id: centroId, nombre })),
  });
}

async function fijarCentro(
  repo: RepositorioAcceso,
  sesionId: string,
  cuentaId: string,
  centro: { centroId: string; usuarioId: string; ultimaSedeId: string | null },
): Promise<Resultado<null, ErrorDeCentro>> {
  const permisos = efectivosDe(await repo.permisosDe(cuentaId, centro.centroId));
  const preferida = centro.ultimaSedeId === null ? null : id<"Sede">(centro.ultimaSedeId);
  const sede = elegirSedeActiva(preferida, permisos);
  if (!sede.ok) return sede;
  await repo.fijarCentro(sesionId, {
    centroId: centro.centroId,
    usuarioId: centro.usuarioId,
    sedeActivaId: sede.valor.sede === "todas" ? null : sede.valor.sede,
  });
  return ok(null);
}

export async function elegirCentro(
  deps: DependenciasAcceso,
  sesion: SesionResuelta,
  centroId: string,
): Promise<Resultado<null, ErrorDeCentro>> {
  const centro = (await deps.repo.centrosDe(sesion.cuentaId)).find((c) => c.centroId === centroId);
  if (centro === undefined) return falla("centro-ajeno", "No tenés acceso a ese centro.");
  return fijarCentro(deps.repo, sesion.sesionId, sesion.cuentaId, centro);
}

export async function resolver(
  deps: DependenciasAcceso,
  token: string,
): Promise<SesionResuelta | undefined> {
  const sesion = await deps.repo.sesionPorToken(deps.claves.hashDeToken(token));
  if (sesion === undefined || !sesionVigente(sesion, deps.ahora())) return undefined;
  await deps.repo.marcarUso(sesion.id, deps.ahora());
  return {
    sesionId: sesion.id,
    cuentaId: sesion.cuentaId,
    debeCambiarClave: sesion.debeCambiarClave,
    centro: await centroActivo(deps.repo, sesion),
  };
}

/** Arma el contexto con los permisos calculados ahora (0007, regla 3) y la sede activa. */
async function centroActivo(
  repo: RepositorioAcceso,
  sesion: SesionGuardada,
): Promise<CentroActivo | null> {
  const { centroId, usuarioId, sedeActivaId } = sesion;
  if (centroId === null || usuarioId === null) return null;
  const permisos = efectivosDe(await repo.permisosDe(sesion.cuentaId, centroId));
  const preferida: SedeActiva = sedeActivaId === null ? "todas" : id<"Sede">(sedeActivaId);
  const sede = elegirSedeActiva(preferida, permisos);
  if (!sede.ok) return null;
  if (sede.valor.cambiada) {
    await repo.fijarSede(sesion.id, sede.valor.sede === "todas" ? null : sede.valor.sede);
  }
  return {
    contexto: {
      centroId: id<"Centro">(centroId),
      actor: { tipo: "usuario", usuarioId: id<"Usuario">(usuarioId) },
      permisosPorSede: permisosDeLaSedeActiva(permisos, sede.valor.sede),
    },
    sedeActiva: sede.valor.sede,
    sedes: sedesConPermisos(permisos),
    sedeCambiada: sede.valor.cambiada,
  };
}

export async function elegirSede(
  deps: DependenciasAcceso,
  sesion: SesionResuelta,
  sede: SedeActiva,
): Promise<Resultado<null, ErrorDeSede>> {
  const centro = sesion.centro;
  if (centro === null) return falla("sin-centro", "Primero elegí un centro.");
  if (sede !== "todas" && !centro.sedes.includes(sede)) {
    return falla("sede-ajena", "No tenés permisos en esa sede.");
  }
  const sedeId = sede === "todas" ? null : sede;
  await deps.repo.fijarSede(sesion.sesionId, sedeId);
  // usuarios se aísla solo por centro: alcanza el contexto de la sesión, sea cual sea su sede.
  const actor = centro.contexto.actor;
  if (actor.tipo === "usuario") {
    await deps.repo.recordarSede(centro.contexto, actor.usuarioId, sedeId);
  }
  return ok(null);
}

export async function cambiarClave(
  deps: DependenciasAcceso,
  sesion: SesionResuelta,
  { actual, nueva }: { actual: string; nueva: string },
): Promise<Resultado<null, ErrorDeClave>> {
  const cuenta = await deps.repo.cuentaPorId(sesion.cuentaId);
  if (cuenta === undefined || !(await deps.claves.verificar(actual, cuenta.hashClave))) {
    return falla("clave-incorrecta", "La contraseña actual no es correcta.");
  }
  const valida = validarClaveNueva(nueva);
  if (!valida.ok) return valida;
  await deps.repo.cambiarClave(cuenta.id, await deps.claves.hashear(nueva));
  await deps.repo.revocarOtras(cuenta.id, sesion.sesionId, deps.ahora());
  return ok(null);
}
