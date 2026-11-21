// La pantalla Asistencia: se arma sin avisos de React y «Avisar ausencia» no deja «Confirmar»
// listo para repetir (ni para anular sin querer) después de usarlo.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { fechaLocal } from "../src/base/controles/ListaRemota.tsx";
import { ANA, pagina } from "./alumnos-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const FECHA = "00000000-0000-4000-8000-0000000000f1";
const AVISO = "00000000-0000-4000-8000-0000000000a1";
const HOY = fechaLocal("America/Argentina/Buenos_Aires");
const PLANILLA = `/api/asistencia/fechas/${FECHA}`;

const ocurrencia = {
  id: FECHA,
  claseId: "00000000-0000-4000-8000-0000000000c1",
  nombre: "Stretching",
  cupo: 10,
  inscriptos: 1,
  fecha: HOY,
  empiezaEn: "2026-11-23T21:30:00.000Z",
  terminaEn: "2026-11-23T22:30:00.000Z",
  cancelada: false,
  profeId: null,
};

function planilla(avisoId: string | null) {
  const { id, claseId, nombre, cupo, fecha: dia, empiezaEn, terminaEn, cancelada } = ocurrencia;
  const fecha = { id, claseId, nombre, cupo, fecha: dia, empiezaEn, terminaEn, cancelada };
  const ana = {
    alumnoId: ANA,
    nombre: "Ana",
    apellido: "Pérez",
    activo: true,
    estado: null,
    avisoId,
  };
  return {
    estado: 200,
    cuerpo: {
      fecha: { ...fecha, sedeId: NORTE },
      alumnos: pagina([ana]).cuerpo,
      recuperan: pagina([]).cuerpo,
      lugares: avisoId ? 1 : 0,
    },
  };
}

function abrirAsistencia(permisos: string[]) {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["asistencia.ver", "agenda.ver", ...permisos],
    }),
    [`GET /api/asistencia/sedes/${NORTE}/reglas`]: {
      estado: 200,
      cuerpo: { anticipacionMinutos: 0, maximoPorAbono: 4, sinAbono: false },
    },
    [`GET /api/agenda/ocurrencias?sede=${NORTE}&desde=${HOY}&pagina=1`]: pagina([ocurrencia]),
    [`GET ${PLANILLA}?pagina=1`]: planilla(null),
    [`POST ${PLANILLA}/avisos`]: { estado: 201, cuerpo: { id: AVISO } },
  });
  return { servidor, usuario: montarPanel() };
}

it("se arma sin el aviso de React por claves repetidas", async () => {
  const errores = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { usuario } = abrirAsistencia(["asistencia.configurar"]);
  await usuario.click(await screen.findByRole("link", { name: "Asistencia" }));
  await screen.findByText("Reglas de recuperación de la sede");
  await screen.findByText("Stretching");

  const claves = errores.mock.calls.filter((llamada) =>
    llamada.some((parte) => String(parte).includes("same key")),
  );
  expect(claves).toEqual([]);
});

it("después de avisar la ausencia se cierra, sin «Confirmar» a la vista", async () => {
  const { servidor, usuario } = abrirAsistencia(["asistencia.avisar"]);
  await usuario.click(await screen.findByRole("link", { name: "Asistencia" }));
  await usuario.click(await screen.findByRole("button", { name: "Ver planilla" }));
  await usuario.click(await screen.findByText("Avisar ausencia"));
  servidor.responder(`GET ${PLANILLA}?pagina=1`, planilla(AVISO));
  await usuario.click(screen.getByRole("button", { name: "Confirmar" }));

  const ana = (await screen.findByText(/Avisó ausencia/)).closest("li");
  if (!ana) throw new Error("Falta la fila de Ana.");
  // El desplegable quedó cerrado: «Confirmar» no está a la vista hasta abrirlo de nuevo.
  const anular = within(ana).getByText("Anular aviso de ausencia").closest("details");
  expect(anular?.open).toBe(false);
  expect(anular?.contains(within(ana).getByRole("button", { name: "Confirmar" }))).toBe(true);
  expect(servidor.pedidos.filter((p) => p.clave === `POST ${PLANILLA}/avisos`)).toHaveLength(1);
});
