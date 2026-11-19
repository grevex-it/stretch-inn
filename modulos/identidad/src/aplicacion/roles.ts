// Roles a medida del centro (0007): las plantillas no se editan ni se borran, se duplican; nadie
// pone en un rol lo que no tiene, tampoco al editar uno que ya tienen otros; un rol en uso no se
// borra. Cada caso recibe el repositorio ya dentro de enContexto.
import { falla, id, ok, type ContextoCentro, type Permiso, type Resultado } from "@app/nucleo";
import { randomUUID } from "node:crypto";
import type { Catalogo } from "../dominio/catalogo.ts";
import { faltantesEnAlgunaSede, faltantesParaOtorgar } from "../dominio/permisos.ts";
import type {
  DatosDeRol,
  EdicionDeRol,
  ErrorDeRoles,
  RepositorioRoles,
  RolGuardado,
} from "./puertos-roles.ts";

type Respuesta<T> = Promise<Resultado<T, ErrorDeRoles>>;

const INEXISTENTE = falla("rol-inexistente", "Ese rol no existe en el centro.");
const DE_PLANTILLA = falla(
  "rol-de-plantilla",
  "Este rol es una plantilla del sistema: no se cambia ni se borra. Duplicalo para armar uno propio.",
);

/** Lo que no está en el catálogo no existe. */
export function fueraDelCatalogo(
  catalogo: Catalogo,
  permisos: readonly Permiso[],
): Resultado<null, ErrorDeRoles> {
  const fuera = permisos.filter((permiso) => !catalogo.todos.includes(permiso));
  if (fuera.length === 0) return ok(null);
  return falla("permiso-inexistente", `Estos permisos no existen: ${fuera.join(", ")}.`);
}

/** Nadie da lo que no tiene (0007, regla 1). */
export function ajenos(faltantes: readonly Permiso[]): Resultado<null, ErrorDeRoles> {
  if (faltantes.length === 0) return ok(null);
  return falla("permisos-ajenos", `No podés dar permisos que no tenés: ${faltantes.join(", ")}.`);
}

function permisosParaDar(
  catalogo: Catalogo,
  faltantes: readonly Permiso[],
  permisos: readonly Permiso[],
): Resultado<null, ErrorDeRoles> {
  const enCatalogo = fueraDelCatalogo(catalogo, permisos);
  return enCatalogo.ok ? ajenos(faltantes) : enCatalogo;
}

async function nombreLibre(
  repo: RepositorioRoles,
  nombre: string,
  salvo?: string,
): Respuesta<string> {
  const limpio = nombre.trim();
  if (limpio === "") return falla("nombre-vacio", "Escribí el nombre del rol.");
  if (await repo.existeRolConNombre(limpio, salvo)) {
    return falla("nombre-repetido", `Ya hay un rol llamado «${limpio}».`);
  }
  return ok(limpio);
}

export async function rol(repo: RepositorioRoles, rolId: string): Respuesta<RolGuardado> {
  const guardado = await repo.rol(rolId);
  return guardado === undefined ? INEXISTENTE : ok(guardado);
}

export async function crearRol(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  datos: DatosDeRol,
): Respuesta<{ id: string }> {
  const permisos = [...new Set(datos.permisos)];
  const faltantes = faltantesEnAlgunaSede(quien.permisosPorSede, permisos);
  const validos = permisosParaDar(catalogo, faltantes, permisos);
  if (!validos.ok) return validos;
  const nombre = await nombreLibre(repo, datos.nombre);
  if (!nombre.ok) return nombre;
  const rolId = randomUUID();
  await repo.crearRol({ id: rolId, nombre: nombre.valor, permisos });
  return ok({ id: rolId });
}

/**
 * Lo que se le suma a un rol llega a todos los que lo tienen: quien edita tiene que tenerlo en
 * cada sede donde se usa, también en las que no ve. Si nadie lo tiene, alcanza con alguna sede.
 */
async function faltantesAlSumar(
  repo: RepositorioRoles,
  quien: ContextoCentro,
  rolId: string,
  sumados: Permiso[],
): Promise<Permiso[]> {
  const sedes = new Set((await repo.asignacionesDelRol(rolId)).map((a) => a.sedeId));
  if (sedes.size === 0) return faltantesEnAlgunaSede(quien.permisosPorSede, sumados);
  const faltantes = [...sedes].flatMap((sede) =>
    faltantesParaOtorgar(quien.permisosPorSede, id<"Sede">(sede), sumados),
  );
  return [...new Set(faltantes)];
}

export async function editarRol(
  repo: RepositorioRoles,
  catalogo: Catalogo,
  quien: ContextoCentro,
  cambio: EdicionDeRol,
): Respuesta<{ version: number }> {
  const actual = await repo.rol(cambio.id);
  if (actual === undefined) return INEXISTENTE;
  if (actual.plantilla !== null) return DE_PLANTILLA;
  const permisos = [...new Set(cambio.permisos)];
  const sumados = permisos.filter((permiso) => !actual.permisos.includes(permiso));
  const faltantes = await faltantesAlSumar(repo, quien, cambio.id, sumados);
  const validos = permisosParaDar(catalogo, faltantes, permisos);
  if (!validos.ok) return validos;
  const nombre = await nombreLibre(repo, cambio.nombre, cambio.id);
  if (!nombre.ok) return nombre;
  const version = await repo.editarRol({ ...cambio, nombre: nombre.valor, permisos });
  if (version === undefined) {
    return falla(
      "cambio-concurrente",
      "Alguien cambió este rol mientras lo editabas: volvé a abrirlo.",
    );
  }
  return ok({ version });
}

/** «Ana», «Ana y Rita», «Ana, Bea y Rita» o, con más de cinco, «Ana, …, Eva y 3 más». */
function quienes(nombres: string[]): string {
  if (nombres.length > 5) return `${nombres.slice(0, 5).join(", ")} y ${nombres.length - 5} más`;
  if (nombres.length === 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1) ?? ""}`;
}

export async function borrarRol(repo: RepositorioRoles, rolId: string): Respuesta<null> {
  const actual = await repo.rol(rolId);
  if (actual === undefined) return INEXISTENTE;
  if (actual.plantilla !== null) return DE_PLANTILLA;
  const nombres = [...new Set((await repo.asignacionesDelRol(rolId)).map((a) => a.nombre))];
  if (nombres.length > 0) {
    const [verbo, cambiar] = nombres.length === 1 ? ["tiene", "cambiale"] : ["tienen", "cambiales"];
    return falla(
      "rol-en-uso",
      `Lo ${verbo} ${quienes(nombres.sort((a, b) => a.localeCompare(b, "es")))}: ${cambiar} el rol antes de borrarlo.`,
    );
  }
  await repo.borrarRol(rolId);
  return ok(null);
}
