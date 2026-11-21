// Cada clase en Agenda: primero el nombre y el dato (día, hora, duración, sede, lugares y estado);
// después, en una misma fila, «Editar clase» y «Ver inscriptos».
import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLASE = "00000000-0000-4000-8000-0000000000cc";

it("muestra el dato de la clase debajo del nombre y las dos acciones juntas", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["agenda.ver", "agenda.gestionar"],
    }),
    [`GET /api/agenda/sedes/${NORTE}/camas`]: { estado: 200, cuerpo: { camas: 10 } },
    [`GET /api/agenda/clases?sede=${NORTE}&pagina=1`]: {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: CLASE,
            sedeId: NORTE,
            nombre: "Stretching",
            dia: 1,
            hora: "18:30",
            duracionMinutos: 60,
            cupo: 10,
            profeId: null,
            inscriptos: 3,
            activa: true,
            version: 1,
          },
        ],
      },
    },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  const clase = (await screen.findByText("Stretching")).closest("li");
  expect(clase?.textContent).toMatch(
    /^StretchingLunes · 18:30 · 60 min · Norte.*3 de 10 lugares ocupados · Activa.*Editar clase.*Ver inscriptos$/,
  );

  const editar = screen.getByText("Editar clase").closest("details");
  const ver = screen.getByRole("button", { name: "Ver inscriptos" });
  expect(editar?.parentElement).toBe(ver.parentElement);
  expect(editar?.parentElement).not.toBe(clase);
});
