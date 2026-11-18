// Las plantillas en los centros que ya existen (0007): identidad_sumar_plantilla crea el rol en
// cada centro e identidad_dar_a_plantilla le da sus permisos. Las dos recorren todos los centros:
// cada test corre en una transacción que se deshace, así no toca los centros de otros tests.
import type {} from "@app/db/pruebas";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, inject, it } from "vitest";

async function conectar(url: string): Promise<pg.Client> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  return cliente;
}

/** Como las migraciones, con el dueño del esquema, y sin dejar nada al terminar. */
async function enTransaccionDeshecha(trabajo: (cliente: pg.Client) => Promise<void>) {
  const cliente = await conectar(inject("urlDueno"));
  try {
    await cliente.query("begin");
    await trabajo(cliente);
  } finally {
    await cliente.query("rollback");
    await cliente.end();
  }
}

async function nuevoCentro(cliente: pg.Client): Promise<string> {
  const centro = randomUUID();
  await cliente.query("insert into centros (id, nombre) values ($1, 'Centro')", [centro]);
  return centro;
}

interface Rol {
  nombre: string;
  plantilla: string | null;
  permisos: string[];
}

async function rolesDe(cliente: pg.Client, centro: string): Promise<Rol[]> {
  const { rows } = await cliente.query<Rol>(
    `select r.nombre, r.plantilla,
            coalesce(array_agg(p.permiso order by p.permiso) filter (where p.permiso is not null),
                     '{}') as permisos
     from roles r left join permisos_de_rol p on p.rol_id = r.id
     where r.centro_id = $1
     group by r.id order by r.nombre`,
    [centro],
  );
  return rows;
}

const sumarProfesor = "select identidad_sumar_plantilla('profesor', 'Profesor')";
const darAlProfesor = "select identidad_dar_a_plantilla('profesor', array['caja.cobrar'])";

describe("plantillas en los centros que ya existen", () => {
  it("crean el rol con su marca y sus permisos en cada centro", async () => {
    await enTransaccionDeshecha(async (cliente) => {
      const [a, b] = [await nuevoCentro(cliente), await nuevoCentro(cliente)];
      await cliente.query(sumarProfesor);
      await cliente.query(darAlProfesor);
      for (const centro of [a, b]) {
        expect(await rolesDe(cliente, centro)).toEqual([
          { nombre: "Profesor", plantilla: "profesor", permisos: ["caja.cobrar"] },
        ]);
      }
    });
  });

  it("se pueden correr dos veces sin efecto doble", async () => {
    await enTransaccionDeshecha(async (cliente) => {
      const centro = await nuevoCentro(cliente);
      await cliente.query(sumarProfesor);
      await cliente.query(darAlProfesor);
      await cliente.query(sumarProfesor);
      await cliente.query(darAlProfesor);
      expect(await rolesDe(cliente, centro)).toEqual([
        { nombre: "Profesor", plantilla: "profesor", permisos: ["caja.cobrar"] },
      ]);
    });
  });

  it("un rol propio con ese nombre queda como estaba, y no recibe los permisos", async () => {
    await enTransaccionDeshecha(async (cliente) => {
      const centro = await nuevoCentro(cliente);
      await cliente.query("insert into roles (centro_id, nombre) values ($1, 'Profesor')", [
        centro,
      ]);
      await cliente.query(sumarProfesor);
      await cliente.query(darAlProfesor);
      expect(await rolesDe(cliente, centro)).toEqual([
        { nombre: "Profesor", plantilla: null, permisos: [] },
      ]);
    });
  });

  it("dar permisos a una plantilla no toca a las demás", async () => {
    await enTransaccionDeshecha(async (cliente) => {
      const centro = await nuevoCentro(cliente);
      await cliente.query("select identidad_sumar_plantilla('recepcion', 'Recepción')");
      await cliente.query(sumarProfesor);
      await cliente.query(darAlProfesor);
      expect(await rolesDe(cliente, centro)).toEqual([
        { nombre: "Profesor", plantilla: "profesor", permisos: ["caja.cobrar"] },
        { nombre: "Recepción", plantilla: "recepcion", permisos: [] },
      ]);
    });
  });

  it("las marcas nuevas son válidas; una desconocida, no", async () => {
    await enTransaccionDeshecha(async (cliente) => {
      const centro = await nuevoCentro(cliente);
      for (const marca of ["encargado", "profesor", "recepcion", "contadora"]) {
        await cliente.query(
          "insert into roles (centro_id, nombre, plantilla) values ($1, $2, $2)",
          [centro, marca],
        );
      }
      await expect(
        cliente.query("select identidad_sumar_plantilla('jefe', 'Jefe')"),
      ).rejects.toThrow(/roles_plantilla/);
    });
  });

  it("la app no las puede llamar: son solo para migraciones", async () => {
    const cliente = await conectar(inject("urlApp"));
    try {
      await expect(cliente.query(sumarProfesor)).rejects.toThrow(/permission denied/);
      await expect(cliente.query(darAlProfesor)).rejects.toThrow(/permission denied/);
    } finally {
      await cliente.end();
    }
  });
});
