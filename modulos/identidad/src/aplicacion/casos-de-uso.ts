// Casos de uso de roles y permisos (ver docs/decisiones/0007 y 0017).
import { falla, id, ok, type ContextoCentro, type Permiso, type Resultado } from "@app/nucleo";
import { randomUUID } from "node:crypto";
import type { Catalogo } from "../dominio/catalogo.ts";
import {
  faltantesEnAlgunaSede,
  faltantesParaOtorgar,
  permisosEfectivos,
  tieneAccesoTotal,
  type PermisosPorSede,
} from "../dominio/permisos.ts";
import type {
  FilaDePermiso,
  FilaDePermisoDeUsuario,
  NuevaAsignacion,
  NuevoAjuste,
  RepositorioIdentidad,
} from "./puertos.ts";

export type ErrorDePermisos =
  | "nombre-vacio"
  | "nombre-repetido"
  | "permisos-ajenos"
  | "rol-inexistente"
  | "asignacion-inexistente"
  | "ultimo-acceso-total";

function efectivosDe(filas: readonly FilaDePermiso[]): PermisosPorSede {
  return permisosEfectivos(
    filas
      .filter((fila) => fila.origen === "rol")
      .map((fila) => ({ sedeId: id<"Sede">(fila.sedeId), permisosDelRol: [fila.permiso] })),
    filas.flatMap((fila) =>
      fila.origen === "rol"
        ? []
        : [{ sedeId: id<"Sede">(fila.sedeId), permiso: fila.permiso, tipo: fila.origen }],
    ),
  );
}

export async function cargarPermisos(
  repo: RepositorioIdentidad,
  cuentaId: string,
  centroId: string,
): Promise<PermisosPorSede> {
  return efectivosDe(await repo.permisosDe(cuentaId, centroId));
}

function ajenos(faltantes: Permiso[]): Resultado<never, ErrorDePermisos> {
  return falla("permisos-ajenos", `No podés dar permisos que no tenés: ${faltantes.join(", ")}.`);
}

export async function crearRol(
  repo: RepositorioIdentidad,
  quien: ContextoCentro,
  { nombre, permisos }: { nombre: string; permisos: readonly Permiso[] },
): Promise<Resultado<{ id: string }, ErrorDePermisos>> {
  if (nombre.trim() === "") return falla("nombre-vacio", "El nombre no puede quedar vacío.");
  const faltantes = faltantesEnAlgunaSede(quien.permisosPorSede, permisos);
  if (faltantes.length > 0) return ajenos(faltantes);
  if (await repo.existeRolConNombre(nombre.trim())) {
    return falla("nombre-repetido", `Ya hay un rol llamado "${nombre.trim()}".`);
  }
  const rolId = randomUUID();
  await repo.crearRol({ id: rolId, nombre: nombre.trim(), permisos });
  return ok({ id: rolId });
}

export async function asignarRol(
  repo: RepositorioIdentidad,
  quien: ContextoCentro,
  asignacion: NuevaAsignacion,
): Promise<Resultado<null, ErrorDePermisos>> {
  const permisos = await repo.permisosDeRol(asignacion.rolId);
  if (permisos === undefined) return falla("rol-inexistente", "Ese rol no existe en el centro.");
  const faltantes = faltantesParaOtorgar(
    quien.permisosPorSede,
    id<"Sede">(asignacion.sedeId),
    permisos,
  );
  if (faltantes.length > 0) return ajenos(faltantes);
  await repo.asignar(asignacion);
  return ok(null);
}

function conAccesoTotal(
  filas: readonly FilaDePermisoDeUsuario[],
  sedesDelCentro: readonly string[],
  catalogo: Catalogo,
): number {
  const sedes = sedesDelCentro.map((sede) => id<"Sede">(sede));
  const porUsuario = new Map<string, FilaDePermisoDeUsuario[]>();
  for (const fila of filas)
    porUsuario.set(fila.usuarioId, [...(porUsuario.get(fila.usuarioId) ?? []), fila]);
  return [...porUsuario.values()].filter((propias) =>
    tieneAccesoTotal(efectivosDe(propias), catalogo.todos, sedes),
  ).length;
}

/**
 * Hace el cambio y verifica después que siga habiendo alguien con acceso total (0007, regla 2).
 * Se llama dentro de conPuntoDeGuardado: si devuelve falla, el cambio se deshace.
 */
export async function cambiarSinPerderAccesoTotal(
  repo: RepositorioIdentidad,
  catalogo: Catalogo,
  cambio: () => Promise<Resultado<null, ErrorDePermisos>>,
): Promise<Resultado<null, ErrorDePermisos>> {
  const sedes = await repo.sedesDelCentro();
  const antes = conAccesoTotal(await repo.permisosDelCentro(), sedes, catalogo);
  const resultado = await cambio();
  if (!resultado.ok) return resultado;
  if (antes > 0 && conAccesoTotal(await repo.permisosDelCentro(), sedes, catalogo) === 0) {
    return falla(
      "ultimo-acceso-total",
      "Tiene que quedar al menos un usuario con acceso total al centro.",
    );
  }
  return resultado;
}

export async function quitarAsignacion(
  repo: RepositorioIdentidad,
  asignacion: NuevaAsignacion,
): Promise<Resultado<null, ErrorDePermisos>> {
  const quitada = await repo.quitarAsignacion(asignacion);
  return quitada ? ok(null) : falla("asignacion-inexistente", "Esa asignación no existe.");
}

export async function ajustarPermiso(
  repo: RepositorioIdentidad,
  quien: ContextoCentro,
  ajuste: NuevoAjuste,
): Promise<Resultado<null, ErrorDePermisos>> {
  const faltantes = faltantesParaOtorgar(quien.permisosPorSede, id<"Sede">(ajuste.sedeId), [
    ajuste.permiso,
  ]);
  if (faltantes.length > 0) return ajenos(faltantes);
  await repo.ajustar(ajuste);
  return ok(null);
}
