// Las reglas de recuperación de la sede (0020), desde Asistencia: se ven con sus valores y se
// cambian con asistencia.configurar.
import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const NORTE_SOLA = [{ id: NORTE, nombre: "Norte" }];
const RUTA = `/api/asistencia/sedes/${NORTE}/reglas`;
const RIO_TERCERO = { anticipacionMinutos: 0, maximoPorAbono: 4, sinAbono: false };

it("muestra las reglas de la sede y guarda las nuevas", async () => {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro(NORTE_SOLA, {
      permisos: ["asistencia.ver", "agenda.ver", "asistencia.configurar"],
    }),
    [`GET ${RUTA}`]: { estado: 200, cuerpo: RIO_TERCERO },
    [`PUT ${RUTA}`]: { estado: 204 },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Asistencia" }));
  await usuario.click(await screen.findByText("Reglas de recuperación de la sede"));

  const anticipacion = await screen.findByLabelText(/Anticipación para anotarse/);
  expect((anticipacion as HTMLInputElement).value).toBe("0");
  await usuario.clear(anticipacion);
  await usuario.type(anticipacion, "60");
  const maximo = screen.getByLabelText(/Máximo de recuperaciones por abono/);
  await usuario.clear(maximo);
  await usuario.type(maximo, "2");
  await usuario.click(screen.getByLabelText(/Puede recuperar sin abono vigente/));
  await usuario.click(screen.getByRole("button", { name: "Guardar reglas" }));

  await vi.waitFor(() => {
    expect(servidor.pedidos.find((pedido) => pedido.clave === `PUT ${RUTA}`)?.cuerpo).toEqual({
      anticipacionMinutos: 60,
      maximoPorAbono: 2,
      sinAbono: true,
    });
  });
});

it("sin asistencia.configurar no aparecen las reglas", async () => {
  servidorFalso({
    "GET /api/sesion": enCentro(NORTE_SOLA, { permisos: ["asistencia.ver", "agenda.ver"] }),
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Asistencia" }));
  expect(await screen.findByText(/Semana desde/)).toBeDefined();
  expect(screen.queryByText("Reglas de recuperación de la sede")).toBeNull();
});
