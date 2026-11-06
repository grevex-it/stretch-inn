// Contratos del equipo (ver docs/decisiones/0017): lo que el panel manda y la API acepta.
import { describe, expect, it } from "vitest";
import { altaHecha, paginaDeEquipo, pedidoDeAlta, pedidoDePagina } from "../src/index.ts";

const UUID = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
const alta = { nombre: " Ana ", email: " ana@ejemplo.com ", rolId: UUID, sedeIds: [UUID] };

describe("pedidoDePagina: ninguna lista sin paginar", () => {
  it("arranca en la página 1 y lee el número de la query", () => {
    expect(pedidoDePagina.parse({})).toEqual({ pagina: 1, porPagina: 50 });
    expect(pedidoDePagina.parse({ pagina: "3" })).toEqual({ pagina: 3, porPagina: 50 });
  });

  it("rechaza páginas que no son enteros positivos", () => {
    for (const pagina of ["0", "-1", "1.5", "x"]) {
      expect(pedidoDePagina.safeParse({ pagina }).success).toBe(false);
    }
  });
});

describe("pedidoDeAlta", () => {
  it("limpia los espacios del nombre y del email", () => {
    expect(pedidoDeAlta.parse(alta)).toEqual({ ...alta, nombre: "Ana", email: "ana@ejemplo.com" });
  });

  it("pide nombre, email válido, rol y al menos una sede", () => {
    expect(pedidoDeAlta.safeParse({ ...alta, nombre: "  " }).success).toBe(false);
    expect(pedidoDeAlta.safeParse({ ...alta, email: "ana" }).success).toBe(false);
    expect(pedidoDeAlta.safeParse({ ...alta, rolId: "x" }).success).toBe(false);
    expect(pedidoDeAlta.safeParse({ ...alta, sedeIds: [] }).success).toBe(false);
  });
});

describe("respuestas", () => {
  it("la clave temporal del alta es null si la cuenta ya existía", () => {
    expect(altaHecha.parse({ usuarioId: UUID, claveTemporal: null })).toEqual({
      usuarioId: UUID,
      claveTemporal: null,
    });
  });

  it("una página del equipo trae los integrantes y el total", () => {
    const pagina = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        {
          id: UUID,
          nombre: "Ana",
          email: "ana@ejemplo.com",
          activo: true,
          asignaciones: [{ sedeId: UUID, rolId: UUID, rol: "Recepción" }],
        },
      ],
    };
    expect(paginaDeEquipo.parse(pagina)).toEqual(pagina);
    expect(paginaDeEquipo.safeParse({ ...pagina, total: undefined }).success).toBe(false);
  });
});
