// Roles por sede y ajustes de cada persona sobre Postgres real (0007): con usuarios.gestionar en
// la sede, nunca a uno mismo, nadie da lo que no tiene, y solo los dueños tocan a quien tiene
// más permisos o permisos en otra sede.
import type {} from "@app/db/pruebas";
import type { ContextoCentro } from "@app/nucleo";
import { crearBase, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { crearAcceso, crearRoles, type Acceso, type Roles } from "../src/index.ts";
import { contextoDe, entrarComo } from "./ayudas-equipo.ts";
import { CATALOGO, centroConPlantillas, persona, type Persona } from "./ayudas-roles.ts";

let base: Base;
let acceso: Acceso;
let roles: Roles;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
  acceso = crearAcceso(base);
  roles = crearRoles(base, { catalogo: CATALOGO });
});
afterAll(async () => {
  await base.cerrar();
});

async function como(quien: Persona): Promise<ContextoCentro> {
  return contextoDe((await entrarComo(acceso, quien.email)).sesion);
}

const error = (codigo: string) => ({ ok: false, error: { codigo } });
const HECHO = { ok: true, valor: null };

describe("una encargada con usuarios.gestionar en Mendoza", () => {
  it("le asigna Profesor a alguien nuevo en Mendoza, y se ve con su origen", async () => {
    const c = await centroConPlantillas();
    const nuevo = await persona(c.centroId, "Nico", []);
    const eli = await como(c.encargada);
    const asignado = { sedeId: c.mendoza, rolId: c.roles.profesor };
    expect(await roles.asignar(eli, nuevo.usuarioId, asignado)).toEqual(HECHO);
    const permisos = await roles.permisosDe(eli, nuevo.usuarioId);
    if (!permisos.ok) throw new Error(permisos.error.mensaje);
    expect(permisos.valor.asignaciones).toEqual([{ ...asignado, rol: "Profesor" }]);
    expect(permisos.valor.permisos).toContainEqual({
      sedeId: c.mendoza,
      permiso: "caja.cobrar",
      roles: ["Profesor"],
      ajuste: null,
      efectivo: true,
    });
  });

  it("no asigna en Río Tercero, donde no gestiona", async () => {
    const c = await centroConPlantillas();
    const nuevo = await persona(c.centroId, "Nico", []);
    const pedido = { sedeId: c.rioTercero, rolId: c.roles.profesor };
    expect(await roles.asignar(await como(c.encargada), nuevo.usuarioId, pedido)).toMatchObject(
      error("sin-gestion-en-la-sede"),
    );
  });

  it("no toca a quien tiene permisos en Río Tercero: ni asigna, ni quita, ni ajusta", async () => {
    const c = await centroConPlantillas();
    const eli = await como(c.encargada);
    const pia = c.profeDeLasDos.usuarioId;
    const enMendoza = { sedeId: c.mendoza, rolId: c.roles.profesor };
    const ajuste = { sedeId: c.mendoza, permiso: "caja.cobrar", tipo: "quitado" } as const;
    expect(await roles.asignar(eli, pia, enMendoza)).toMatchObject(error("mas-permisos"));
    expect(await roles.quitarAsignacion(eli, pia, enMendoza)).toMatchObject(error("mas-permisos"));
    expect(await roles.ajustar(eli, pia, ajuste)).toMatchObject(error("mas-permisos"));
  });

  it("no toca al Dueño ni a la Contaduría", async () => {
    const c = await centroConPlantillas();
    const eli = await como(c.encargada);
    const ajuste = { sedeId: c.mendoza, permiso: "caja.ver", tipo: "quitado" } as const;
    const deshacer = { sedeId: c.mendoza, permiso: "caja.ver" } as const;
    for (const otro of [c.dueno, c.contaduria]) {
      expect(await roles.ajustar(eli, otro.usuarioId, ajuste)).toMatchObject(
        error("persona-protegida"),
      );
      expect(await roles.quitarAjuste(eli, otro.usuarioId, deshacer)).toMatchObject(
        error("persona-protegida"),
      );
    }
  });

  it("no toca a una Contaduría que está solo en Mendoza: eso es de quien gestiona roles", async () => {
    const c = await centroConPlantillas();
    const eli = await como(c.encargada);
    const carla = await persona(c.centroId, "Carla", [[c.mendoza, c.roles.contadora]]);
    const enMendoza = { sedeId: c.mendoza, rolId: c.roles.contadora };
    const ajuste = { sedeId: c.mendoza, permiso: "caja.ver", tipo: "quitado" } as const;
    const deshacer = { sedeId: c.mendoza, permiso: "caja.ver" } as const;
    expect(await roles.ajustar(eli, carla.usuarioId, ajuste)).toMatchObject(
      error("persona-protegida"),
    );
    expect(await roles.quitarAjuste(eli, carla.usuarioId, deshacer)).toMatchObject(
      error("persona-protegida"),
    );
    expect(await roles.quitarAsignacion(eli, carla.usuarioId, enMendoza)).toMatchObject(
      error("persona-protegida"),
    );
    const profe = { sedeId: c.mendoza, rolId: c.roles.profesor };
    expect(await roles.asignar(eli, carla.usuarioId, profe)).toMatchObject(
      error("persona-protegida"),
    );
    expect(await roles.ajustar(await como(c.dueno), carla.usuarioId, ajuste)).toEqual(HECHO);
  });

  it("no da lo que no tiene: ni asistencia.configurar como extra, ni el rol Dueño", async () => {
    const c = await centroConPlantillas();
    const eli = await como(c.encargada);
    const pablo = c.profeDeMendoza.usuarioId;
    const extra = { sedeId: c.mendoza, permiso: "asistencia.configurar", tipo: "extra" } as const;
    expect(await roles.ajustar(eli, pablo, extra)).toMatchObject(error("permisos-ajenos"));
    const dueno = { sedeId: c.mendoza, rolId: c.roles.dueno };
    expect(await roles.asignar(eli, pablo, dueno)).toMatchObject(error("permisos-ajenos"));
  });

  it("no se cambia a sí misma", async () => {
    const c = await centroConPlantillas();
    const ajuste = { sedeId: c.mendoza, permiso: "caja.cobrar", tipo: "quitado" } as const;
    expect(
      await roles.ajustar(await como(c.encargada), c.encargada.usuarioId, ajuste),
    ).toMatchObject(error("a-vos-mismo"));
  });
});

describe("un dueño", () => {
  async function otroDueno(c: Awaited<ReturnType<typeof centroConPlantillas>>) {
    return persona(c.centroId, "Lucas", [
      [c.mendoza, c.roles.dueno],
      [c.rioTercero, c.roles.dueno],
    ]);
  }

  it("cambia los permisos de cualquiera en cualquier sede, también los de otro dueño", async () => {
    const c = await centroConPlantillas();
    const lucas = await otroDueno(c);
    const lore = await como(c.dueno);
    const ajuste = { sedeId: c.rioTercero, permiso: "caja.ver", tipo: "quitado" } as const;
    expect(await roles.ajustar(lore, lucas.usuarioId, ajuste)).toEqual(HECHO);
    const permisos = await roles.permisosDe(lore, lucas.usuarioId);
    if (!permisos.ok) throw new Error(permisos.error.mensaje);
    expect(permisos.valor.permisos).toContainEqual({
      sedeId: c.rioTercero,
      permiso: "caja.ver",
      roles: ["Dueño"],
      ajuste: "quitado",
      efectivo: false,
    });
    const deshacer = { sedeId: c.rioTercero, permiso: "caja.ver" } as const;
    expect(await roles.quitarAjuste(lore, lucas.usuarioId, deshacer)).toEqual(HECHO);
  });

  it("tampoco se cambia a sí mismo", async () => {
    const c = await centroConPlantillas();
    const suyo = { sedeId: c.mendoza, rolId: c.roles.dueno };
    expect(
      await roles.quitarAsignacion(await como(c.dueno), c.dueno.usuarioId, suyo),
    ).toMatchObject(error("a-vos-mismo"));
  });

  it("le saca el Dueño a otro dueño; después, ese ya no toca al que queda", async () => {
    const c = await centroConPlantillas();
    const lucas = await otroDueno(c);
    const deLucas = { sedeId: c.rioTercero, rolId: c.roles.dueno };
    expect(await roles.quitarAsignacion(await como(c.dueno), lucas.usuarioId, deLucas)).toEqual(
      HECHO,
    );
    const deLore = { sedeId: c.mendoza, rolId: c.roles.dueno };
    expect(
      await roles.quitarAsignacion(await como(lucas), c.dueno.usuarioId, deLore),
    ).toMatchObject(error("mas-permisos"));
  });

  it("con una sede activa, avisa si la persona tiene permisos en otras sedes", async () => {
    const c = await centroConPlantillas();
    const otras = async (quien: ContextoCentro, usuarioId: string) => {
      const permisos = await roles.permisosDe(quien, usuarioId);
      if (!permisos.ok) throw new Error(permisos.error.mensaje);
      return permisos.valor.enOtrasSedes;
    };
    expect(await otras(await como(c.dueno), c.profeDeLasDos.usuarioId)).toBe(false);
    const { sesion } = await entrarComo(acceso, c.dueno.email, { sede: c.mendoza });
    const enMendoza = contextoDe(sesion);
    expect(await otras(enMendoza, c.profeDeLasDos.usuarioId)).toBe(true);
    expect(await otras(enMendoza, c.profeDeMendoza.usuarioId)).toBe(false);
  });

  it("lo que no existe responde que no existe", async () => {
    const c = await centroConPlantillas();
    const otro = await centroConPlantillas();
    const lore = await como(c.dueno);
    const pablo = c.profeDeMendoza.usuarioId;
    const enMendoza = { sedeId: c.mendoza, rolId: c.roles.encargado };
    expect(await roles.asignar(lore, otro.profeDeMendoza.usuarioId, enMendoza)).toMatchObject(
      error("usuario-inexistente"),
    );
    const ajeno = { sedeId: c.mendoza, rolId: otro.roles.encargado };
    expect(await roles.asignar(lore, pablo, ajeno)).toMatchObject(error("rol-inexistente"));
    expect(await roles.quitarAsignacion(lore, pablo, enMendoza)).toMatchObject(
      error("asignacion-inexistente"),
    );
    const sinAjuste = { sedeId: c.mendoza, permiso: "caja.ver" } as const;
    expect(await roles.quitarAjuste(lore, pablo, sinAjuste)).toMatchObject(
      error("ajuste-inexistente"),
    );
    const fuera = { sedeId: c.mendoza, permiso: "gastos.ver", tipo: "extra" } as const;
    expect(await roles.ajustar(lore, pablo, fuera)).toMatchObject(error("permiso-inexistente"));
  });
});
