// Casos de uso del equipo del centro: lista, alta, reset de clave y bloqueo (0007 y 0017).
// Cada uno recibe el repositorio ya dentro de enContexto.
import { falla, id, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { puedeGestionarA, validarAlta } from "../dominio/equipo.ts";
import { faltantesParaOtorgar } from "../dominio/permisos.ts";
import { efectivosDe } from "./casos-de-uso.ts";
import type {
  DatosDeAlta,
  ErrorDeEquipo,
  Integrante,
  Pagina,
  PaginaDe,
  RepositorioEquipo,
} from "./puertos-equipo.ts";

export interface DependenciasEquipo {
  hashear(clave: string): Promise<string>;
  claveTemporal(): string;
  ahora(): Date;
}

type ResultadoDeEquipo<T> = Promise<Resultado<T, ErrorDeEquipo>>;

const INEXISTENTE = falla("usuario-inexistente", "Esa persona no es del equipo del centro.");

/** Una página del equipo con email y roles, en tres consultas (sin N+1). */
export async function listar(
  repo: RepositorioEquipo,
  pagina: Pagina,
): Promise<PaginaDe<Integrante>> {
  const usuarios = await repo.usuarios(pagina);
  const ids = usuarios.elementos.map((u) => u.id);
  const [asignaciones, emails] = await Promise.all([repo.asignacionesDe(ids), repo.emailsDe(ids)]);
  return {
    ...usuarios,
    elementos: usuarios.elementos.map((u) => ({
      ...u,
      email: emails.get(u.id) ?? "",
      asignaciones: asignaciones
        .filter((a) => a.usuarioId === u.id)
        .map(({ sedeId, rolId, rol }) => ({ sedeId, rolId, rol })),
    })),
  };
}

/** Nadie da permisos que no tiene, en cada sede del alta (0007, regla 1). */
async function puedeDarElRol(
  repo: RepositorioEquipo,
  quien: ContextoCentro,
  rolId: string,
  sedeIds: readonly string[],
): ResultadoDeEquipo<null> {
  const permisos = await repo.permisosDeRol(rolId);
  if (permisos === undefined) return falla("rol-inexistente", "Ese rol no existe en el centro.");
  const faltantes = new Set(
    sedeIds.flatMap((sede) =>
      faltantesParaOtorgar(quien.permisosPorSede, id<"Sede">(sede), permisos),
    ),
  );
  if (faltantes.size > 0) {
    return falla(
      "permisos-ajenos",
      `No podés dar permisos que no tenés en esas sedes: ${[...faltantes].join(", ")}.`,
    );
  }
  return ok(null);
}

export async function darDeAlta(
  repo: RepositorioEquipo,
  deps: DependenciasEquipo,
  quien: ContextoCentro,
  datos: DatosDeAlta,
): ResultadoDeEquipo<{ usuarioId: string; claveTemporal: string | null }> {
  const validos = validarAlta(datos);
  if (!validos.ok) return validos;
  const { nombre, sedeIds } = validos.valor;
  const permitido = await puedeDarElRol(repo, quien, datos.rolId, sedeIds);
  if (!permitido.ok) return permitido;
  const clave = deps.claveTemporal();
  const cuenta = await repo.cuentaParaAlta(datos.email.trim(), await deps.hashear(clave));
  const usuarioId = await repo.crearUsuario({ cuentaId: cuenta.cuentaId, nombre });
  if (usuarioId === undefined) {
    return falla("ya-es-del-equipo", "Esa persona ya es del equipo del centro.");
  }
  await repo.asignar(usuarioId, sedeIds, datos.rolId);
  return ok({ usuarioId, claveTemporal: cuenta.nueva ? clave : null });
}

/** Quien gestiona, comparado con el objetivo en todas sus sedes, esté activo o no. */
async function gestionable(
  repo: RepositorioEquipo,
  quien: ContextoCentro,
  usuarioId: string,
): ResultadoDeEquipo<{ cuentaId: string }> {
  const usuario = await repo.usuario(usuarioId);
  if (usuario === undefined) return INEXISTENTE;
  const actor = quien.actor.tipo === "usuario" ? quien.actor.usuarioId : quien.actor.operadorId;
  const regla = puedeGestionarA(
    { usuarioId: actor, permisos: quien.permisosPorSede },
    { usuarioId, permisos: efectivosDe(await repo.permisosDeUsuario(usuarioId)) },
  );
  return regla.ok ? ok({ cuentaId: usuario.cuentaId }) : regla;
}

export async function resetearClave(
  repo: RepositorioEquipo,
  deps: DependenciasEquipo,
  quien: ContextoCentro,
  usuarioId: string,
): ResultadoDeEquipo<{ claveTemporal: string }> {
  const objetivo = await gestionable(repo, quien, usuarioId);
  if (!objetivo.ok) return objetivo;
  const clave = deps.claveTemporal();
  const reset = await repo.resetearClave(usuarioId, await deps.hashear(clave));
  if (reset === "inexistente") return INEXISTENTE;
  if (reset === "otros-centros") {
    return falla(
      "otros-centros",
      "Esta persona también trabaja en otro centro: su contraseña la resetea el soporte.",
    );
  }
  await repo.revocarSesionesDeCuenta(objetivo.valor.cuentaId, deps.ahora());
  return ok({ claveTemporal: clave });
}

/** Bloquear cierra sus sesiones en este centro en el momento (0017); en los demás sigue entrando. */
export async function fijarActivo(
  repo: RepositorioEquipo,
  deps: DependenciasEquipo,
  quien: ContextoCentro,
  cambio: { usuarioId: string; activo: boolean },
): ResultadoDeEquipo<null> {
  const objetivo = await gestionable(repo, quien, cambio.usuarioId);
  if (!objetivo.ok) return objetivo;
  await repo.fijarActivo(cambio.usuarioId, cambio.activo);
  if (!cambio.activo) await repo.revocarSesionesDeUsuario(cambio.usuarioId, deps.ahora());
  return ok(null);
}
