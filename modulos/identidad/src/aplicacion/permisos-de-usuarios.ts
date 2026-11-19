// Roles por sede y ajustes de cada integrante (0007 y 0017): con usuarios.gestionar en la sede,
// nunca a uno mismo, nadie da lo que no tiene, y solo un dueño toca a quien tiene más permisos o
// permisos en otra sede. Cada caso recibe el repositorio ya dentro de enContexto.
import { falla, id, ok, type ContextoCentro, type Permiso, type Resultado } from "@app/nucleo";
import type { Catalogo } from "../dominio/catalogo.ts";
import { puedeCambiarPermisosDe } from "../dominio/equipo.ts";
import { faltantesParaOtorgar, tieneAccesoTotal } from "../dominio/permisos.ts";
import { efectivosDe } from "./casos-de-uso.ts";
import type {
  ErrorDeRoles,
  PermisoConOrigen,
  PermisosDeIntegrante,
  RepositorioRoles,
} from "./puertos-roles.ts";
import type { NuevaAsignacion, NuevoAjuste } from "./puertos.ts";
import { ajenos, fueraDelCatalogo } from "./roles.ts";

type Respuesta<T> = Promise<Resultado<T, ErrorDeRoles>>;

const INEXISTENTE = falla("usuario-inexistente", "Esa persona no es del equipo del centro.");

function actorDe(quien: ContextoCentro): string {
  return quien.actor.tipo === "usuario" ? quien.actor.usuarioId : quien.actor.operadorId;
}

/** Si quien lo pide puede cambiarle los permisos a esa persona en esa sede. */
async function cambiable(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  objetivo: { usuarioId: string; sedeId: string },
): Respuesta<null> {
  if (!(await repo.existeUsuario(objetivo.usuarioId))) return INEXISTENTE;
  const sedes = (await repo.sedesDelCentro()).map((sede) => id<"Sede">(sede));
  return puedeCambiarPermisosDe(
    { usuarioId: actorDe(quien), permisos: quien.permisosPorSede },
    {
      usuarioId: objetivo.usuarioId,
      permisos: efectivosDe(await repo.permisosDeUsuario(objetivo.usuarioId)),
    },
    {
      sedeId: id<"Sede">(objetivo.sedeId),
      esDueno: tieneAccesoTotal(quien.permisosPorSede, catalogo.todos, sedes),
      protegido: await repo.esProtegido(objetivo.usuarioId),
    },
  );
}

export async function asignar(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  asignacion: NuevaAsignacion,
): Respuesta<null> {
  const permitido = await cambiable(repo, catalogo, quien, asignacion);
  if (!permitido.ok) return permitido;
  const permisos = await repo.permisosDeRol(asignacion.rolId);
  if (permisos === undefined) return falla("rol-inexistente", "Ese rol no existe en el centro.");
  const sede = id<"Sede">(asignacion.sedeId);
  const propios = ajenos(faltantesParaOtorgar(quien.permisosPorSede, sede, permisos));
  if (!propios.ok) return propios;
  await repo.asignar(asignacion);
  return ok(null);
}

export async function quitarAsignacion(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  asignacion: NuevaAsignacion,
): Respuesta<null> {
  const permitido = await cambiable(repo, catalogo, quien, asignacion);
  if (!permitido.ok) return permitido;
  if (await repo.quitarAsignacion(asignacion)) return ok(null);
  return falla("asignacion-inexistente", "Esa persona no tiene ese rol en esa sede.");
}

/** Si quien lo pide no tiene ese permiso en esa sede, no lo da ni lo saca. */
function delQuePide(quien: ContextoCentro, ajuste: { sedeId: string; permiso: Permiso }) {
  return faltantesParaOtorgar(quien.permisosPorSede, id<"Sede">(ajuste.sedeId), [ajuste.permiso]);
}

/** Un extra da el permiso y un quitado lo saca; los dos, solo con permisos que uno tiene ahí. */
export async function ajustar(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  ajuste: NuevoAjuste,
): Respuesta<null> {
  const existe = fueraDelCatalogo(catalogo, [ajuste.permiso]);
  if (!existe.ok) return existe;
  const permitido = await cambiable(repo, catalogo, quien, ajuste);
  if (!permitido.ok) return permitido;
  const propios = ajenos(delQuePide(quien, ajuste));
  if (!propios.ok) return propios;
  await repo.ajustar(ajuste);
  return ok(null);
}

export async function quitarAjuste(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  ajuste: Omit<NuevoAjuste, "tipo">,
): Respuesta<null> {
  const permitido = await cambiable(repo, catalogo, quien, ajuste);
  if (!permitido.ok) return permitido;
  const propios = ajenos(delQuePide(quien, ajuste));
  if (!propios.ok) return propios;
  if (await repo.quitarAjuste(ajuste)) return ok(null);
  return falla("ajuste-inexistente", "Esa persona no tiene ese ajuste en esa sede.");
}

/** Por sede y permiso: de qué roles viene, si tiene un ajuste y si al final lo tiene. */
export async function permisosDe(
  repo: RepositorioRoles,
  usuarioId: string,
): Respuesta<PermisosDeIntegrante> {
  if (!(await repo.existeUsuario(usuarioId))) return INEXISTENTE;
  const { asignaciones, ajustes } = await repo.rolesYAjustesDe(usuarioId);
  const filas = new Map<string, PermisoConOrigen>();
  const fila = (sedeId: string, permiso: PermisoConOrigen["permiso"]) => {
    const clave = `${sedeId} ${permiso}`;
    const existente = filas.get(clave);
    if (existente !== undefined) return existente;
    const nueva: PermisoConOrigen = { sedeId, permiso, roles: [], ajuste: null, efectivo: false };
    filas.set(clave, nueva);
    return nueva;
  };
  for (const a of asignaciones) for (const p of a.permisos) fila(a.sedeId, p).roles.push(a.rol);
  for (const a of ajustes) fila(a.sedeId, a.permiso).ajuste = a.tipo;
  for (const f of filas.values()) {
    f.efectivo = f.ajuste === "extra" || (f.ajuste === null && f.roles.length > 0);
  }
  return ok({
    asignaciones: asignaciones.map(({ sedeId, rolId, rol }) => ({ sedeId, rolId, rol })),
    permisos: [...filas.values()],
  });
}
