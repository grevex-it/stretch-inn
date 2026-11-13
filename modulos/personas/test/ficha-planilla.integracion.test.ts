// La ficha según la planilla de Stretch Inn (0022): número de socio, celular opcional (el alumno
// queda pendiente de completar), fecha de inicio y fecha de baja. Sobre Postgres real, con RLS.
import { type ContextoCentro } from "@app/nucleo";
import { crearBase, enContexto, type Base } from "@app/plataforma";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  crearAlumno,
  editarAlumno,
  fijarActivo,
  listarAlumnos,
  obtenerAlumno,
  type DatosDeAlumno,
} from "../src/index.ts";
import { ANA, contextoConPermisos } from "./ayudas.ts";

let base: Base;
beforeAll(() => {
  base = crearBase(inject("urlApp"));
});
afterAll(async () => {
  await base.cerrar();
});

const nuevoCentro = () => contextoConPermisos(base, ["personas.ver", "personas.editar"]);
const PRIMERA = { pagina: 1, porPagina: 50 };

async function alta(ctx: ContextoCentro, datos: Partial<DatosDeAlumno> = {}) {
  const resultado = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, ...datos }));
  if (!resultado.ok) throw new Error(resultado.error.mensaje);
  return resultado.valor.id;
}

const leer = (ctx: ContextoCentro, id: string) =>
  enContexto(base, ctx, (tx) => obtenerAlumno(tx, id));

describe("número de socio", () => {
  it("sin número, toma el siguiente del centro; con número, ese", async () => {
    const ctx = await nuevoCentro();
    const primero = await alta(ctx);
    const importado = await alta(ctx, { numeroDeSocio: 282 });
    const siguiente = await alta(ctx);

    expect((await leer(ctx, primero))?.numeroDeSocio).toBe(1);
    expect((await leer(ctx, importado))?.numeroDeSocio).toBe(282);
    expect((await leer(ctx, siguiente))?.numeroDeSocio).toBe(283);
  });

  it("no se repite dentro del centro, pero sí en otro centro", async () => {
    const [ctx, otro] = [await nuevoCentro(), await nuevoCentro()];
    await alta(ctx, { numeroDeSocio: 54 });

    const repetido = await enContexto(base, ctx, (tx) =>
      crearAlumno(tx, { ...ANA, documento: null, numeroDeSocio: 54 }),
    );
    expect(!repetido.ok && repetido.error.codigo).toBe("socio-repetido");
    await alta(otro, { numeroDeSocio: 54 });
  });

  it("se busca por número de socio", async () => {
    const ctx = await nuevoCentro();
    await alta(ctx, { numeroDeSocio: 187, nombre: "Adriana" });
    await alta(ctx, { numeroDeSocio: 212, nombre: "Beatriz" });

    const lista = await enContexto(base, ctx, (tx) =>
      listarAlumnos(tx, { ...PRIMERA, buscar: "187" }),
    );
    expect(lista.elementos.map((a) => a.nombre)).toEqual(["Adriana"]);
  });
});

describe("celular y fecha de inicio", () => {
  it("sin celular se carga igual y queda pendiente de completar", async () => {
    const ctx = await nuevoCentro();
    const sin = await alta(ctx, { telefono: null });
    const con = await alta(ctx);

    expect(await leer(ctx, sin)).toMatchObject({ telefono: null, pendienteDeCompletar: true });
    expect(await leer(ctx, con)).toMatchObject({ pendienteDeCompletar: false });
    const corto = await enContexto(base, ctx, (tx) => crearAlumno(tx, { ...ANA, telefono: "123" }));
    expect(!corto.ok && corto.error.codigo).toBe("telefono-invalido");
  });

  it("la fecha de inicio se guarda y no puede ser futura", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx, { fechaDeInicio: "2024-03-01" });
    expect((await leer(ctx, id))?.fechaDeInicio).toBe("2024-03-01");

    const futura = await enContexto(base, ctx, (tx) =>
      crearAlumno(tx, { ...ANA, fechaDeInicio: "2999-01-01" }),
    );
    expect(!futura.ok && futura.error.codigo).toBe("fecha-invalida");
  });

  it("editar sin mandar el número de socio ni la fecha de inicio los conserva", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx, { numeroDeSocio: 65, fechaDeInicio: "2024-03-01" });

    const sinCampos = await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, nombre: "Ana María", id, version: 1 }),
    );
    expect(sinCampos.ok).toBe(true);
    expect(await leer(ctx, id)).toMatchObject({
      nombre: "Ana María",
      numeroDeSocio: 65,
      fechaDeInicio: "2024-03-01",
    });

    await enContexto(base, ctx, (tx) =>
      editarAlumno(tx, { ...ANA, id, version: 2, numeroDeSocio: 66, fechaDeInicio: null }),
    );
    expect(await leer(ctx, id)).toMatchObject({ numeroDeSocio: 66, fechaDeInicio: null });
  });
});

describe("fecha de baja", () => {
  it("la baja guarda cuándo fue; la reactivación la borra", async () => {
    const ctx = await nuevoCentro();
    const id = await alta(ctx);
    expect((await leer(ctx, id))?.bajaEn).toBeNull();

    const antes = Date.now();
    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: false }));
    const deBaja = await leer(ctx, id);
    expect(deBaja?.bajaEn?.getTime()).toBeGreaterThanOrEqual(antes - 1000);

    await enContexto(base, ctx, (tx) => fijarActivo(tx, { id, activo: true }));
    expect((await leer(ctx, id))?.bajaEn).toBeNull();
  });
});
