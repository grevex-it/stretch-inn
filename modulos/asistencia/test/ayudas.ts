// Datos de prueba: un centro con dos sedes (Norte y Sur) y una persona que entra de verdad, con
// permisos distintos en cada una. El contexto sale de una sesión real (regla 1 de AGENTS.md).
// La clase, sus inscriptos y su fecha se arman con la API pública de agenda y personas.
import type {} from "@app/db/pruebas";
import { crearAgenda } from "@app/agenda";
import { crearAcceso, hashearClave } from "@app/identidad";
import type { ContextoCentro } from "@app/nucleo";
import { crearAlumno } from "@app/personas";
import { enContexto, type Base } from "@app/plataforma";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";

const CLAVE = "una clave bien larga";

/** Lo que hace falta para armar la clase y sus inscriptos. */
export const ARMAR = [
  "agenda.ver",
  "agenda.gestionar",
  "agenda.inscribir",
  "personas.ver",
  "personas.editar",
];
const TODO = [...ARMAR, "asistencia.ver", "asistencia.tomar", "asistencia.avisar"];

/** Como dueño del esquema: sin RLS. Para armar datos y para contar lo que quedó guardado. */
export async function comoDueno<Fila extends pg.QueryResultRow = pg.QueryResultRow>(
  consulta: string,
  valores: unknown[] = [],
): Promise<Fila[]> {
  const cliente = new pg.Client({ connectionString: inject("urlDueno") });
  await cliente.connect();
  try {
    return (await cliente.query<Fila>(consulta, valores)).rows;
  } finally {
    await cliente.end();
  }
}

async function rolCon(centro: string, permisos: readonly string[]): Promise<string> {
  const rol = randomUUID();
  await comoDueno("insert into roles (id, centro_id, nombre) values ($1, $2, $3)", [
    rol,
    centro,
    `Rol ${rol}`,
  ]);
  for (const permiso of permisos) {
    await comoDueno("insert into permisos_de_rol values ($1, $2, $3)", [centro, rol, permiso]);
  }
  return rol;
}

/** Una persona del centro con esos permisos en cada sede, con su contexto de una sesión real. */
async function persona(
  base: Base,
  centro: string,
  sedes: readonly (readonly [string, readonly string[]])[],
): Promise<ContextoCentro> {
  const [cuenta, usuario] = [randomUUID(), randomUUID()];
  const email = `${cuenta}@prueba.com`;
  await comoDueno(
    "insert into plataforma.cuentas (id, email, hash_clave, debe_cambiar_clave) values ($1, $2, $3, false)",
    [cuenta, email, await hashearClave(CLAVE)],
  );
  await comoDueno(
    "insert into usuarios (id, centro_id, cuenta_id, nombre) values ($1, $2, $3, 'Ana')",
    [usuario, centro, cuenta],
  );
  for (const [sede, permisos] of sedes) {
    if (permisos.length === 0) continue;
    const rol = await rolCon(centro, permisos);
    await comoDueno("insert into asignaciones values ($1, $2, $3, $4)", [
      centro,
      usuario,
      sede,
      rol,
    ]);
  }
  const acceso = crearAcceso(base);
  const ingreso = await acceso.entrar({ email, clave: CLAVE, origen: randomUUID() });
  if (!ingreso.ok) throw new Error(ingreso.error.mensaje);
  const sesion = await acceso.resolver(ingreso.valor.token);
  if (sesion?.centro == null) throw new Error("La sesión no quedó en el centro.");
  return sesion.centro.contexto;
}

async function alumno(base: Base, ctx: ContextoCentro, nombre: string): Promise<string> {
  const alta = await enContexto(base, ctx, (tx) =>
    crearAlumno(tx, {
      nombre,
      apellido: "Prueba",
      telefono: "11 5555-1234",
      documento: null,
      email: null,
      fechaNacimiento: null,
      notas: "",
    }),
  );
  if (!alta.ok) throw new Error(alta.error.mensaje);
  return alta.valor.id;
}

/** El lunes de la semana que viene, AAAA-MM-DD (en UTC: alcanza para los tests). */
function proximoLunes(): string {
  const enUnaSemana = new Date(Date.now() + 7 * 86_400_000);
  const dia = enUnaSemana.getUTCDay() || 7;
  return new Date(enUnaSemana.getTime() - (dia - 1) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Un centro con Norte y Sur, una clase de Norte con Ana y Bea inscriptas y su fecha de la
 * semana que viene. `ctx` tiene todos los permisos en Norte; `otra(permisos)` arma otra persona
 * del mismo centro con esos permisos en Norte.
 */
export async function claseConFecha(base: Base) {
  const centro = randomUUID();
  const [norte, sur] = [randomUUID(), randomUUID()];
  await comoDueno("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  await comoDueno(
    "insert into sedes (id, centro_id, nombre) values ($1, $3, 'Norte'), ($2, $3, 'Sur')",
    [norte, sur, centro],
  );
  const ctx = await persona(base, centro, [[norte, TODO]]);
  const agenda = crearAgenda(base);
  const clase = await agenda.crearClase(ctx, {
    nombre: "Stretching",
    dia: 1,
    hora: "18:30",
    duracionMinutos: 60,
    cupo: 12,
    sedeId: norte,
  });
  if (!clase.ok) throw new Error(clase.error.mensaje);
  const ana = await alumno(base, ctx, "Ana");
  const bea = await alumno(base, ctx, "Bea");
  for (const alumnoId of [ana, bea]) {
    const alta = await agenda.inscribir(ctx, { claseId: clase.valor.id, alumnoId });
    if (!alta.ok) throw new Error(alta.error.mensaje);
  }
  const semana = await agenda.semana(ctx, {
    pagina: 1,
    porPagina: 50,
    sedeId: norte,
    desde: proximoLunes(),
  });
  const fecha = semana.ok ? semana.valor.elementos[0] : undefined;
  if (fecha === undefined) throw new Error("La clase no tiene fecha la semana que viene.");
  return {
    ctx,
    agenda,
    norte,
    sur,
    ana,
    bea,
    fecha,
    nuevoAlumno: (nombre: string) => alumno(base, ctx, nombre),
    otra: (permisos: readonly string[]) => persona(base, centro, [[norte, permisos]]),
  };
}
