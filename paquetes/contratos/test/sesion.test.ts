// Contratos de sesión (ver docs/decisiones/0017): lo que el panel manda y la API acepta.
import { describe, expect, it } from "vitest";
import {
  estadoDeSesion,
  pedidoDeCambioDeClave,
  pedidoDeCentro,
  pedidoDeIngreso,
  pedidoDeSede,
} from "../src/index.ts";

const UUID = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";

describe("pedidoDeIngreso", () => {
  it("acepta email y clave, y limpia los espacios del email", () => {
    expect(pedidoDeIngreso.parse({ email: "  ana@ejemplo.com ", clave: "x" })).toEqual({
      email: "ana@ejemplo.com",
      clave: "x",
    });
  });

  it("rechaza un email sin forma de email o una clave vacía", () => {
    expect(pedidoDeIngreso.safeParse({ email: "ana", clave: "x" }).success).toBe(false);
    expect(pedidoDeIngreso.safeParse({ email: "ana@ejemplo.com", clave: "" }).success).toBe(false);
  });

  it("no deja pasar claves gigantes: scrypt no se usa para atacar la CPU", () => {
    const clave = "x".repeat(1025);
    expect(pedidoDeIngreso.safeParse({ email: "ana@ejemplo.com", clave }).success).toBe(false);
  });
});

describe("pedidoDeCentro y pedidoDeSede", () => {
  it("el centro es un uuid", () => {
    expect(pedidoDeCentro.safeParse({ centroId: UUID }).success).toBe(true);
    expect(pedidoDeCentro.safeParse({ centroId: "centro-1" }).success).toBe(false);
  });

  it("la sede es un uuid o «todas»", () => {
    expect(pedidoDeSede.safeParse({ sede: UUID }).success).toBe(true);
    expect(pedidoDeSede.safeParse({ sede: "todas" }).success).toBe(true);
    expect(pedidoDeSede.safeParse({ sede: "ninguna" }).success).toBe(false);
  });
});

describe("estadoDeSesion", () => {
  it("el centro activo y sus sedes llegan con nombre, para el selector", () => {
    const estado = {
      debeCambiarClave: false,
      centros: [{ id: UUID, nombre: "Centro" }],
      centroActivo: {
        id: UUID,
        nombre: "Centro",
        sedeActiva: "todas",
        sedes: [{ id: UUID, nombre: "Norte" }],
        sedeCambiada: false,
        permisos: ["usuarios.ver"],
        zonaHoraria: "America/Argentina/Buenos_Aires",
      },
    };
    expect(estadoDeSesion.parse(estado)).toEqual(estado);
    const sinNombres = { ...estado, centroActivo: { ...estado.centroActivo, sedes: [UUID] } };
    expect(estadoDeSesion.safeParse(sinNombres).success).toBe(false);
  });

  it("el centro activo trae su zona horaria: las fechas se muestran en esa zona", () => {
    const centroActivo = {
      id: UUID,
      nombre: "Centro",
      sedeActiva: "todas",
      sedes: [],
      sedeCambiada: false,
      permisos: [],
    };
    const estado = { debeCambiarClave: false, centros: [], centroActivo };
    expect(estadoDeSesion.safeParse(estado).success).toBe(false);
  });
});

describe("pedidoDeCambioDeClave", () => {
  it("la nueva tiene que tener al menos 10 caracteres, con el mensaje para el usuario", () => {
    const resultado = pedidoDeCambioDeClave.safeParse({ actual: "x", nueva: "corta" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      "La contraseña tiene que tener al menos 10 caracteres.",
    );
  });
});
