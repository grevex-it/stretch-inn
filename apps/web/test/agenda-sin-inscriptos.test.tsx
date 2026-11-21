// Sin inscriptos, la lista de una clase lo dice con sus palabras y no con el «No hay resultados.»
// de las otras listas.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { pagina } from "./alumnos-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLASE = "00000000-0000-4000-8000-0000000000c1";

const clase = {
  id: CLASE,
  sedeId: NORTE,
  nombre: "Stretching",
  dia: 1,
  hora: "18:30",
  duracionMinutos: 60,
  cupo: 10,
  profeId: null,
  inscriptos: 0,
  activa: true,
  version: 1,
};

it("sin inscriptos dice «Todavía no hay inscriptos.»", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], { permisos: ["agenda.ver"] }),
    [`GET /api/agenda/clases?sede=${NORTE}&pagina=1`]: pagina([clase]),
    [`GET /api/agenda/clases/${CLASE}/inscriptos?pagina=1`]: pagina([]),
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  await usuario.click(await screen.findByRole("button", { name: "Ver inscriptos" }));
  const tarjeta = (await screen.findByText("Stretching", { selector: "strong" })).closest("li");
  if (!(tarjeta instanceof HTMLElement)) throw new Error("No está la clase");
  expect(await within(tarjeta).findByText("Todavía no hay inscriptos.")).toBeDefined();
  expect(within(tarjeta).queryByText("No hay resultados.")).toBeNull();
});
