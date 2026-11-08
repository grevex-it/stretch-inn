// Contratos de la asistencia: la planilla de una fecha y las marcas que se guardan.
import { describe, expect, it } from "vitest";
import {
  avisoHecho,
  pedidoDeAsistencia,
  paginaDeCreditos,
  pedidoDeAviso,
  planillaDeAsistencia,
} from "../src/index.ts";

const UUID = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";

describe("avisos de ausencia", () => {
  it("el aviso lleva el alumno; la respuesta, el id con que se anula", () => {
    expect(pedidoDeAviso.parse({ alumnoId: UUID })).toEqual({ alumnoId: UUID });
    expect(pedidoDeAviso.safeParse({ alumnoId: "ana" }).error?.issues[0]?.message).toBe(
      "Ese alumno no existe.",
    );
    expect(avisoHecho.parse({ id: UUID, conCredito: true })).toEqual({
      id: UUID,
      conCredito: true,
    });
  });

  it("los créditos del alumno son una página con su sede, su fecha y su vencimiento", () => {
    const pagina = {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        { id: UUID, sedeId: UUID, ocurrenciaId: UUID, venceEn: "2026-12-09T21:30:00.000Z" },
      ],
    };
    expect(paginaDeCreditos.parse(pagina)).toEqual(pagina);
  });
});

describe("pedidoDeAsistencia", () => {
  it("lleva de 1 a 100 marcas con presente o ausente", () => {
    const pedido = { marcas: [{ alumnoId: UUID, estado: "presente" }] };
    expect(pedidoDeAsistencia.parse(pedido)).toEqual(pedido);
    const vacio = pedidoDeAsistencia.safeParse({ marcas: [] });
    expect(vacio.error?.issues[0]?.message).toBe("Marcá al menos un alumno.");
    const muchas = Array.from({ length: 101 }, () => ({ alumnoId: UUID, estado: "ausente" }));
    expect(pedidoDeAsistencia.safeParse({ marcas: muchas }).success).toBe(false);
    const raro = pedidoDeAsistencia.safeParse({ marcas: [{ alumnoId: UUID, estado: "tarde" }] });
    expect(raro.error?.issues[0]?.message).toBe("Cada alumno va presente o ausente.");
  });
});

describe("planillaDeAsistencia", () => {
  it("trae la fecha y una página de alumnos, con el estado null si no se marcó", () => {
    const planilla = {
      fecha: {
        id: UUID,
        claseId: UUID,
        sedeId: UUID,
        nombre: "Stretching",
        fecha: "2026-11-09",
        empiezaEn: "2026-11-09T21:30:00.000Z",
        terminaEn: "2026-11-09T22:30:00.000Z",
        cancelada: false,
      },
      alumnos: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            alumnoId: UUID,
            nombre: "Ana",
            apellido: "Pérez",
            activo: true,
            estado: null,
            avisoId: UUID,
          },
        ],
      },
    };
    expect(planillaDeAsistencia.parse(planilla)).toEqual(planilla);
  });
});
