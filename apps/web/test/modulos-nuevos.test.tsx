import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE, SUR } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const sedes = [
  { id: NORTE, nombre: "Norte" },
  { id: SUR, nombre: "Sur" },
];

it("abre Agenda y muestra los inscriptos de la clase elegida", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro(sedes, { permisos: ["agenda.ver"] }),
    "GET /api/agenda/clases?pagina=1": {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: SUR,
            sedeId: NORTE,
            nombre: "Stretch",
            dia: 1,
            hora: "09:00",
            duracionMinutos: 45,
            cupo: 8,
            inscriptos: 1,
            activa: true,
            version: 1,
          },
        ],
      },
    },
    [`GET /api/agenda/clases/${SUR}/inscriptos?pagina=1`]: {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: SUR,
            alumnoId: NORTE,
            nombre: "Ana",
            apellido: "Pérez",
            telefono: "",
            activo: true,
            creadaEn: "2026-11-01T00:00:00Z",
          },
        ],
      },
    },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  await usuario.click(await screen.findByRole("button", { name: "Ver inscriptos" }));
  expect(await screen.findByText("Ana Pérez")).toBeDefined();
});

it.each(["Asistencia", "Caja"])(
  "pide una sede al abrir %s desde todas las sedes",
  async (nombre) => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(sedes, {
        permisos: ["agenda.ver", "asistencia.ver", "caja.ver"],
      }),
    });
    const usuario = montarPanel();
    await usuario.click(await screen.findByRole("link", { name: nombre }));
    expect(await screen.findByText(/Elegí una sede en la barra/)).toBeDefined();
    expect(servidor.pedidos.every((pedido) => pedido.clave === "GET /api/sesion")).toBe(true);
  },
);
