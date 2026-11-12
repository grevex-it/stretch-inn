// Casos de uso de la planilla de asistencia. El permiso se controla en la sede de la fecha (0007).
// Figuran quienes tenían inscripción vigente al empezar la fecha (agenda) y los que recuperan.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { TOMAR, VER } from "../dominio/permisos.ts";
import { limpiarMarcas, puedeTomar, type Marca } from "../dominio/planilla.ts";
import { fechaCon, registroDe } from "./comun.ts";
import type {
  ErrorDeAsistencia,
  Pagina,
  PaginaDe,
  Planilla,
  Renglon,
  RepositorioAsistencia,
} from "./puertos.ts";
import { lugaresDe } from "./recuperaciones.ts";

/**
 * La misma página de inscriptos y de los que recuperan, con sus alumnos, marcas y avisos: las
 * dos listas y sus datos en una cantidad fija de consultas (regla 8).
 */
export async function planilla(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  { fechaId, ...pagina }: Pagina & { fechaId: string },
): Promise<Resultado<Planilla, ErrorDeAsistencia>> {
  const fecha = await fechaCon(repo, quien, VER, fechaId);
  if (!fecha.ok) return fecha;
  const { claseId, empiezaEn } = fecha.valor;
  const inscriptos = await repo.inscriptos({ ...pagina, claseId, momento: empiezaEn });
  const recuperan = await repo.recuperan({ ...pagina, ocurrenciaId: fechaId });
  const ids = [...inscriptos.elementos, ...recuperan.elementos].map((i) => i.alumnoId);
  const datos = {
    alumnos: await repo.alumnos(ids),
    marcas: await repo.marcas(fechaId, ids),
    avisos: await repo.avisos(fechaId, ids),
  };
  return ok({
    fecha: fecha.valor,
    alumnos: renglones(inscriptos, datos),
    recuperan: renglones(recuperan, datos),
    lugares: await lugaresDe(repo, fecha.valor),
  });
}

function renglones(
  pagina: PaginaDe<{ alumnoId: string; recuperacionId?: string }>,
  {
    alumnos,
    marcas,
    avisos,
  }: {
    alumnos: Awaited<ReturnType<RepositorioAsistencia["alumnos"]>>;
    marcas: Awaited<ReturnType<RepositorioAsistencia["marcas"]>>;
    avisos: Awaited<ReturnType<RepositorioAsistencia["avisos"]>>;
  },
): PaginaDe<Renglon> {
  return {
    ...pagina,
    elementos: pagina.elementos.flatMap(({ alumnoId, recuperacionId }) => {
      const alumno = alumnos.get(alumnoId);
      if (alumno === undefined) return [];
      const estado = marcas.get(alumnoId) ?? null;
      return [
        {
          alumnoId,
          ...alumno,
          estado,
          avisoId: avisos.get(alumnoId) ?? null,
          ...(recuperacionId === undefined ? {} : { recuperacionId }),
        },
      ];
    }),
  };
}

/** Guarda o corrige las marcas: todas o ninguna, y solo de inscriptos o de los que recuperan. */
export async function tomar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  ahora: Date,
  { fechaId, marcas }: { fechaId: string; marcas: readonly Marca[] },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  const limpias = limpiarMarcas(marcas);
  if (!limpias.ok) return limpias;
  const fecha = await fechaCon(repo, quien, TOMAR, fechaId);
  if (!fecha.ok) return fecha;
  const regla = puedeTomar(fecha.valor, ahora);
  if (!regla.ok) return regla;
  const alumnoIds = limpias.valor.map((m) => m.alumnoId);
  const { claseId, empiezaEn } = fecha.valor;
  const estaban = await repo.estabanInscriptos({ claseId, momento: empiezaEn, alumnoIds });
  const recuperan = await repo.recuperanEntre(fechaId, alumnoIds);
  if (alumnoIds.some((id) => !estaban.has(id) && !recuperan.has(id))) {
    return falla("no-inscripto", "Hay un alumno que no estaba inscripto en esta fecha.");
  }
  await repo.guardar(fecha.valor, limpias.valor, registroDe(quien, ahora));
  return ok(null);
}
