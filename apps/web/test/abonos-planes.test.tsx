// Cada plan en Abonos: primero el nombre y el dato (clases, precio, estado); después, en una
// misma fila, «Editar plan» y «Generar cuota».
import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PLAN = "00000000-0000-4000-8000-0000000000bb";

it("muestra el dato del plan debajo del nombre y las dos acciones juntas", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["abonos.ver", "abonos.gestionar", "abonos.asignar", "personas.ver"],
    }),
    "GET /api/abonos/planes?pagina=1": {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: PLAN,
            nombre: "Una por semana",
            clases: 4,
            precio: 30_000,
            activo: true,
            version: 1,
            preciosDeSede: [],
          },
        ],
      },
    },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Abonos" }));
  const plan = (await screen.findByText("Una por semana")).closest("li");
  expect(plan?.textContent).toMatch(
    /^Una por semana4 clases · .*Activo.*Editar plan.*Generar cuota/,
  );

  const editar = screen.getByText("Editar plan").closest("details");
  const generar = screen.getByText("Generar cuota").closest("details");
  expect(editar?.parentElement).toBe(generar?.parentElement);
  expect(editar?.parentElement).not.toBe(plan);
});
