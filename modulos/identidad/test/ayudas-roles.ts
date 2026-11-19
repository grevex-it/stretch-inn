// Datos de prueba para los roles a medida, las asignaciones y los ajustes: un centro con las sedes
// Mendoza y Río Tercero, las cinco plantillas y su equipo. El contexto sale siempre de una
// sesión real (regla 1 de AGENTS.md).
import { randomUUID } from "node:crypto";
import { crearCatalogo, PERMISOS_IDENTIDAD, plantillasDelSistema } from "../src/index.ts";
import { comoDueno, cuenta } from "./ayudas-acceso.ts";

/** Un catálogo chico con lo que separa a las plantillas entre sí. */
export const CATALOGO = crearCatalogo([
  PERMISOS_IDENTIDAD,
  {
    seccion: "Alumnos",
    permisos: [
      { permiso: "personas.ver", descripcion: "Ver" },
      { permiso: "personas.ver-salud", descripcion: "Ver la salud" },
    ],
  },
  {
    seccion: "Asistencia",
    permisos: [
      { permiso: "asistencia.ver", descripcion: "Ver" },
      { permiso: "asistencia.configurar", descripcion: "Configurar" },
    ],
  },
  {
    seccion: "Caja",
    permisos: [
      { permiso: "caja.ver", descripcion: "Ver" },
      { permiso: "caja.cobrar", descripcion: "Cobrar" },
    ],
  },
]);

type Marca = "dueno" | "encargado" | "profesor" | "recepcion" | "contadora";

/** Copia las plantillas al centro, como el alta. */
async function copiarPlantillas(centroId: string): Promise<Record<Marca, string>> {
  const roles: Partial<Record<Marca, string>> = {};
  for (const plantilla of plantillasDelSistema(CATALOGO)) {
    const rolId = randomUUID();
    await comoDueno(
      "insert into roles (id, centro_id, nombre, plantilla) values ($1, $2, $3, $4)",
      [rolId, centroId, plantilla.nombre, plantilla.plantilla],
    );
    await comoDueno("insert into permisos_de_rol select $1, $2, unnest($3::text[])", [
      centroId,
      rolId,
      plantilla.permisos,
    ]);
    roles[plantilla.plantilla] = rolId;
  }
  return roles as Record<Marca, string>;
}

export interface Persona {
  usuarioId: string;
  email: string;
}

/** Una persona del centro con ese nombre y esos roles por sede. */
export async function persona(
  centroId: string,
  nombre: string,
  asignaciones: [sedeId: string, rolId: string][],
): Promise<Persona> {
  const { cuentaId, email } = await cuenta();
  const usuarioId = randomUUID();
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, $4)",
    [usuarioId, centroId, cuentaId, nombre],
  );
  for (const [sedeId, rolId] of asignaciones) {
    await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [
      centroId,
      usuarioId,
      sedeId,
      rolId,
    ]);
  }
  return { usuarioId, email };
}

/**
 * Mendoza y Río Tercero, con: un Dueño en las dos, una encargada de Mendoza con usuarios.gestionar
 * en Mendoza (ajuste), Contaduría en las dos, un profe en Mendoza y otro en las dos.
 */
export async function centroConPlantillas() {
  const [centroId, mendoza, rioTercero] = [randomUUID(), randomUUID(), randomUUID()];
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centroId]);
  await comoDueno(
    "insert into sedes (id, centro_id, nombre) values ($2, $1, 'Mendoza'), ($3, $1, 'Río Tercero')",
    [centroId, mendoza, rioTercero],
  );
  const roles = await copiarPlantillas(centroId);
  const enLasDos = (rolId: string): [string, string][] => [
    [mendoza, rolId],
    [rioTercero, rolId],
  ];
  const dueno = await persona(centroId, "Lore", enLasDos(roles.dueno));
  const encargada = await persona(centroId, "Eli", [[mendoza, roles.encargado]]);
  await comoDueno("insert into ajustes values ($1, $2, $3, 'usuarios.gestionar', 'extra')", [
    centroId,
    encargada.usuarioId,
    mendoza,
  ]);
  const contaduria = await persona(centroId, "Carla", enLasDos(roles.contadora));
  const profeDeMendoza = await persona(centroId, "Pablo", [[mendoza, roles.profesor]]);
  const profeDeLasDos = await persona(centroId, "Pía", enLasDos(roles.profesor));
  return {
    centroId,
    mendoza,
    rioTercero,
    roles,
    dueno,
    encargada,
    contaduria,
    profeDeMendoza,
    profeDeLasDos,
  };
}

export type CentroConPlantillas = Awaited<ReturnType<typeof centroConPlantillas>>;
