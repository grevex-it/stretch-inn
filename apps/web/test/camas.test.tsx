// Las camas de la sede desde Agenda (pedido del 12/11): son el cupo de todos sus horarios. Se ven
// y se cambian con agenda.gestionar; al crear una clase, su cupo arranca en las camas.
import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE, SUR } from "./render.tsx";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const NORTE_SOLA = [{ id: NORTE, nombre: "Norte" }];
const GESTIONA = { permisos: ["agenda.ver", "agenda.gestionar"] };
const CAMAS = `/api/agenda/sedes/${NORTE}/camas`;
const CLASES = (pagina: number) => `GET /api/agenda/clases?sede=${NORTE}&pagina=${String(pagina)}`;

function clase(numero: number, inscriptos: number) {
  return {
    id: `${String(numero).padStart(8, "0")}-6a8f-4f58-9a43-1b2c3d4e5f60`,
    sedeId: NORTE,
    nombre: `Clase ${String(numero)}`,
    dia: 1,
    hora: "09:00",
    duracionMinutos: 60,
    cupo: 10,
    profeId: null,
    inscriptos,
    activa: true,
    version: 1,
  };
}

function pagina(numero: number, total: number, elementos: unknown[]): Respuesta {
  return { estado: 200, cuerpo: { pagina: numero, porPagina: 50, total, elementos } };
}

const SIN_CLASES = pagina(1, 0, []);

async function abrirCamas(camas: number | null, rutas: Record<string, Respuesta> = {}) {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro(NORTE_SOLA, GESTIONA),
    [CLASES(1)]: SIN_CLASES,
    [`GET ${CAMAS}`]: { estado: 200, cuerpo: { camas } },
    ...rutas,
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  await usuario.click(await screen.findByText("Camas de la sede"));
  return { servidor, usuario };
}

it("muestra las camas de la sede y guarda las nuevas", async () => {
  const { servidor, usuario } = await abrirCamas(8, { [`PUT ${CAMAS}`]: { estado: 204 } });
  const campo = await screen.findByLabelText("Camas de la sede (el cupo de todos sus horarios)");
  expect((campo as HTMLInputElement).value).toBe("8");
  await usuario.clear(campo);
  await usuario.type(campo, "10");
  await usuario.click(screen.getByRole("button", { name: "Guardar camas" }));
  await vi.waitFor(() => {
    expect(servidor.pedidos.find((p) => p.clave === `PUT ${CAMAS}`)?.cuerpo).toEqual({
      camas: 10,
    });
  });
  expect(await screen.findByText("Cambios guardados.")).toBeDefined();
});

it("las camas son obligatorias: no se puede dejar la sede sin tope", async () => {
  const { servidor, usuario } = await abrirCamas(8);
  const campo = await screen.findByLabelText("Camas de la sede (el cupo de todos sus horarios)");
  expect((campo as HTMLInputElement).required).toBe(true);
  expect((campo as HTMLInputElement).min).toBe("1");
  await usuario.clear(campo);
  await usuario.click(screen.getByRole("button", { name: "Guardar camas" }));
  expect(servidor.pedidos.some((p) => p.clave === `PUT ${CAMAS}`)).toBe(false);
});

it("si la sede no tiene camas, avisa que hay que cargarlas", async () => {
  await abrirCamas(null);
  expect(await screen.findByText(/Esta sede todavía no tiene camas cargadas/)).toBeDefined();
  const campo = screen.getByLabelText("Camas de la sede (el cupo de todos sus horarios)");
  expect((campo as HTMLInputElement).value).toBe("");
});

it("si bajarlas deja afuera a fijos, lista todas las clases que lo impiden, de todas las páginas", async () => {
  const primera = Array.from({ length: 50 }, (_, i) => clase(i + 1, i === 4 ? 7 : 2));
  const { usuario } = await abrirCamas(10, {
    [`PUT ${CAMAS}`]: {
      estado: 409,
      cuerpo: {
        error: {
          codigo: "camas-menos-que-inscriptos",
          mensaje: "Clase 5 tiene 7 fijos: las camas no pueden ser menos.",
        },
      },
    },
    [CLASES(1)]: pagina(1, 52, primera),
    [CLASES(2)]: pagina(2, 52, [clase(51, 1), clase(52, 9)]),
  });
  const campo = await screen.findByLabelText("Camas de la sede (el cupo de todos sus horarios)");
  await usuario.clear(campo);
  await usuario.type(campo, "5");
  await usuario.click(screen.getByRole("button", { name: "Guardar camas" }));

  expect(await screen.findByText(/las camas no pueden ser menos/)).toBeDefined();
  const lista = await screen.findByRole("list", { name: "Clases con más fijos que 5 camas" });
  expect(lista.textContent).toContain("Clase 5 · 7 fijos");
  expect(lista.textContent).toContain("Clase 52 · 9 fijos");
  expect(lista.querySelectorAll("li")).toHaveLength(2);
});

it("si bajarlas deja afuera recuperaciones, muestra la fecha que lo impide", async () => {
  const { usuario } = await abrirCamas(10, {
    [`PUT ${CAMAS}`]: {
      estado: 409,
      cuerpo: {
        error: {
          codigo: "fecha-completa",
          mensaje: "El 24/11/2026 no queda lugar: lo ocupan recuperaciones.",
        },
      },
    },
  });
  const campo = await screen.findByLabelText("Camas de la sede (el cupo de todos sus horarios)");
  await usuario.clear(campo);
  await usuario.type(campo, "5");
  await usuario.click(screen.getByRole("button", { name: "Guardar camas" }));
  expect(await screen.findByText(/El 24\/11\/2026 no queda lugar/)).toBeDefined();
});

it("sin agenda.gestionar, o con todas las sedes, no aparecen las camas", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro(NORTE_SOLA, { permisos: ["agenda.ver"] }),
    [CLASES(1)]: SIN_CLASES,
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  expect(await screen.findByText("No hay resultados.")).toBeDefined();
  expect(screen.queryByText("Camas de la sede")).toBeNull();
});

it("con la vista de todas las sedes no aparecen las camas", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro(
      [
        { id: NORTE, nombre: "Norte" },
        { id: SUR, nombre: "Sur" },
      ],
      GESTIONA,
    ),
    "GET /api/agenda/clases?pagina=1": SIN_CLASES,
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Agenda" }));
  expect(await screen.findByText("No hay resultados.")).toBeDefined();
  expect(screen.queryByText("Camas de la sede")).toBeNull();
});

it("al crear una clase, el cupo arranca en las camas de la sede", async () => {
  const { usuario } = await abrirCamas(8);
  await usuario.click(screen.getByText("Nueva clase"));
  const cupo = await screen.findByLabelText("Cupo");
  await vi.waitFor(() => {
    expect((cupo as HTMLInputElement).value).toBe("8");
  });
  expect((cupo as HTMLInputElement).max).toBe("8");
});

it("si la sede no tiene camas, el cupo de la clase nueva queda vacío", async () => {
  const { usuario } = await abrirCamas(null);
  await usuario.click(screen.getByText("Nueva clase"));
  await screen.findByText(/Esta sede todavía no tiene camas cargadas/);
  const cupo = await screen.findByLabelText("Cupo");
  expect((cupo as HTMLInputElement).value).toBe("");
});
