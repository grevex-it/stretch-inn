// Los inscriptos de una clase se ven dentro de su tarjeta, debajo de sus botones, y no al final
// de la lista: con muchos horarios quedarían lejos de la clase tocada. Una clase abierta a la vez;
// tocar de nuevo «Ver inscriptos» los cierra.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const MANANA = "00000000-0000-4000-8000-0000000000c1";
const TARDE = "00000000-0000-4000-8000-0000000000c2";

function clase(id: string, nombre: string, hora: string) {
  return {
    id,
    sedeId: NORTE,
    nombre,
    dia: 1,
    hora,
    duracionMinutos: 60,
    cupo: 10,
    profeId: null,
    inscriptos: 1,
    activa: true,
    version: 1,
  };
}

function inscriptos(id: string, nombre: string) {
  return {
    estado: 200,
    cuerpo: {
      pagina: 1,
      porPagina: 50,
      total: 1,
      elementos: [
        {
          id,
          alumnoId: NORTE,
          nombre,
          apellido: "Pérez",
          telefono: null,
          activo: true,
          creadaEn: "2026-11-01T00:00:00Z",
        },
      ],
    },
  };
}

async function abrirAgenda() {
  servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["agenda.ver", "agenda.inscribir", "personas.ver"],
    }),
    [`GET /api/agenda/clases?sede=${NORTE}&pagina=1`]: {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 2,
        elementos: [clase(MANANA, "Mañana", "09:00"), clase(TARDE, "Tarde", "18:30")],
      },
    },
    [`GET /api/agenda/clases/${MANANA}/inscriptos?pagina=1`]: inscriptos(MANANA, "Ana"),
    [`GET /api/agenda/clases/${TARDE}/inscriptos?pagina=1`]: inscriptos(TARDE, "Beto"),
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  return usuario;
}

/** La tarjeta de la clase: el `li` que tiene su nombre. */
async function tarjeta(nombre: string) {
  const elemento = (await screen.findByText(nombre, { selector: "strong" })).closest("li");
  if (!(elemento instanceof HTMLElement)) throw new Error(`No está la clase ${nombre}`);
  return elemento;
}

it("muestra los inscriptos y «Inscribir alumno» dentro de la tarjeta, debajo de sus botones", async () => {
  const usuario = await abrirAgenda();
  const manana = await tarjeta("Mañana");
  await usuario.click(within(manana).getByRole("button", { name: "Ver inscriptos" }));

  const ana = await within(manana).findByText("Ana Pérez");
  const inscribir = within(manana).getByText("Inscribir alumno");
  const botones = within(manana).getByRole("button", { name: "Ver inscriptos" }).parentElement;
  const siguiente = Node.DOCUMENT_POSITION_FOLLOWING;
  expect(botones?.compareDocumentPosition(inscribir) ?? 0).toBe(siguiente);
  expect(botones?.contains(inscribir)).toBe(false);
  expect(inscribir.compareDocumentPosition(ana) & siguiente).toBe(siguiente);
  expect(within(await tarjeta("Tarde")).queryByText("Inscribir alumno")).toBeNull();
});

it("deja una sola clase abierta y la cierra al tocar de nuevo «Ver inscriptos»", async () => {
  const usuario = await abrirAgenda();
  const manana = await tarjeta("Mañana");
  const tarde = await tarjeta("Tarde");
  const verManana = within(manana).getByRole("button", { name: "Ver inscriptos" });
  const verTarde = within(tarde).getByRole("button", { name: "Ver inscriptos" });

  await usuario.click(verManana);
  expect(await within(manana).findByText("Ana Pérez")).toBeDefined();
  expect(verManana.getAttribute("aria-expanded")).toBe("true");

  await usuario.click(verTarde);
  expect(await within(tarde).findByText("Beto Pérez")).toBeDefined();
  expect(within(manana).queryByText("Ana Pérez")).toBeNull();
  expect(verManana.getAttribute("aria-expanded")).toBe("false");

  await usuario.click(verTarde);
  expect(within(tarde).queryByText("Beto Pérez")).toBeNull();
  expect(within(tarde).queryByText("Inscribir alumno")).toBeNull();
  expect(verTarde.getAttribute("aria-expanded")).toBe("false");
});
