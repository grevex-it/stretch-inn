// Inscribir un alumno desde los inscriptos de una clase: al confirmar, el formulario queda limpio
// (sin búsqueda ni alumno elegido) para no dejar «Confirmar» listo para repetir. Si la API lo
// rechaza, queda como estaba para corregir. Sin inscriptos, la lista lo dice con sus palabras.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { alumno, pagina } from "./alumnos-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLASE = "00000000-0000-4000-8000-0000000000c1";
const ANA = "00000000-0000-4000-8000-0000000000aa";
const INSCRIPTOS = `/api/agenda/clases/${CLASE}/inscriptos`;

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

async function abrirInscriptos(alInscribir: Respuesta = { estado: 201, cuerpo: { id: ANA } }) {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["agenda.ver", "agenda.inscribir", "personas.ver"],
    }),
    [`GET /api/agenda/clases?sede=${NORTE}&pagina=1`]: pagina([clase]),
    [`GET ${INSCRIPTOS}?pagina=1`]: pagina([]),
    "GET /api/alumnos?buscar=Ana&pagina=1": pagina([alumno(ANA, "Ana", "Pérez")]),
    [`POST ${INSCRIPTOS}`]: alInscribir,
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  await usuario.click(await screen.findByRole("button", { name: "Ver inscriptos" }));
  return { servidor, usuario };
}

async function elegirAna(usuario: Awaited<ReturnType<typeof abrirInscriptos>>["usuario"]) {
  await usuario.click(await screen.findByText("Inscribir alumno"));
  await usuario.type(screen.getByRole("searchbox", { name: "Buscar alumno" }), "Ana");
  await usuario.click(await screen.findByRole("button", { name: "Ana Pérez" }));
}

it("sin inscriptos dice «Todavía no hay inscriptos.»", async () => {
  await abrirInscriptos();
  const tarjeta = (await screen.findByText("Stretching", { selector: "strong" })).closest("li");
  if (!(tarjeta instanceof HTMLElement)) throw new Error("No está la clase");
  expect(await within(tarjeta).findByText("Todavía no hay inscriptos.")).toBeDefined();
  expect(within(tarjeta).queryByText("No hay resultados.")).toBeNull();
});

it("después de inscribir limpia la búsqueda y el alumno elegido", async () => {
  const { servidor, usuario } = await abrirInscriptos();
  await elegirAna(usuario);
  await usuario.click(screen.getByRole("button", { name: "Confirmar" }));

  expect(await screen.findByText("Inscribiste a Ana Pérez.")).toBeDefined();
  expect(servidor.pedidos.filter((p) => p.clave === `POST ${INSCRIPTOS}`)).toHaveLength(1);
  expect(servidor.pedidos.find((p) => p.clave === `POST ${INSCRIPTOS}`)?.cuerpo).toEqual({
    alumnoId: ANA,
  });
  const buscador = screen.getByRole("searchbox", { name: "Buscar alumno" });
  expect(buscador).toHaveProperty("value", "");
  expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ana Pérez" })).toBeNull();
});

it("si la API rechaza la inscripción, deja al alumno elegido y muestra el motivo", async () => {
  const { usuario } = await abrirInscriptos({
    estado: 409,
    cuerpo: { error: { codigo: "cupo-completo", mensaje: "La clase no tiene lugar." } },
  });
  await elegirAna(usuario);
  await usuario.click(screen.getByRole("button", { name: "Confirmar" }));

  expect(await screen.findByText("La clase no tiene lugar.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Confirmar" })).toBeDefined();
  const buscador = screen.getByRole("searchbox", { name: "Buscar alumno" });
  expect(buscador).toHaveProperty("value", "Ana");
});
