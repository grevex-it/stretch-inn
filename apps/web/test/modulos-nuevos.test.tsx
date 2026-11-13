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
            profeId: null,
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

it("da de alta un plan de abono y vuelve a consultar la lista", async () => {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro(sedes, { permisos: ["abonos.ver", "abonos.gestionar"] }),
    "GET /api/abonos/planes?pagina=1": {
      estado: 200,
      cuerpo: { pagina: 1, porPagina: 50, total: 0, elementos: [] },
    },
    "POST /api/abonos/planes": { estado: 201, cuerpo: { id: SUR } },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Abonos" }));
  await usuario.click(screen.getByText("Nuevo plan"));
  await usuario.type(screen.getByLabelText("Nombre del plan"), "Mensual");
  const clases = screen.getByLabelText("Clases del abono");
  await usuario.clear(clases);
  await usuario.type(clases, "4");
  await usuario.type(screen.getByLabelText("Precio general en pesos"), "12000");
  await usuario.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByText("Cambios guardados.")).toBeDefined();
  expect(
    servidor.pedidos.find((pedido) => pedido.clave === "POST /api/abonos/planes")?.cuerpo,
  ).toEqual({ nombre: "Mensual", clases: 4, precio: 12000 });
  expect(
    servidor.pedidos.filter((pedido) => pedido.clave === "GET /api/abonos/planes?pagina=1"),
  ).toHaveLength(2);
});
