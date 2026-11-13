// Cobrar una cuota desde Caja (0019 y 0020): la cuota se ve con su inicio y sus clases, y los
// medios de pago son efectivo y transferencia.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE, SUR } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ANA = "00000000-0000-4000-8000-0000000000aa";
const PLAN = "00000000-0000-4000-8000-0000000000bb";

it("muestra el inicio y las clases de la cuota, y cobra con efectivo o transferencia", async () => {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["caja.ver", "caja.cobrar", "personas.ver", "abonos.ver"],
    }),
    "GET /api/alumnos?buscar=Ana&pagina=1": {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: ANA,
            nombre: "Ana",
            apellido: "Pérez",
            telefono: "2610000000",
            documento: null,
            email: null,
            fechaNacimiento: null,
            notas: "",
            activo: true,
            version: 1,
          },
        ],
      },
    },
    [`GET /api/alumnos/${ANA}/cuotas?pagina=1`]: {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: SUR,
            alumnoId: ANA,
            planId: PLAN,
            sedeId: NORTE,
            desde: "2026-11-30",
            clases: 4,
            monto: 28_000,
            pagadaEn: null,
            pagoId: null,
          },
        ],
      },
    },
    "POST /api/caja/cobros": { estado: 201, cuerpo: { id: PLAN, monto: 28_000, repetido: false } },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Caja" }));
  await usuario.click(await screen.findByText("Cobrar cuota"));
  await usuario.type(screen.getByLabelText("Buscar alumno"), "Ana");
  await usuario.click(await screen.findByRole("button", { name: "Ana Pérez" }));

  expect(await screen.findByText(/Desde el 30\/11\/2026 · 4 clases/)).toBeDefined();
  const medio = screen.getByLabelText("Medio de pago");
  const opciones = within(medio)
    .getAllByRole("option")
    .map((opcion) => opcion.textContent);
  expect(opciones).toEqual(["Elegí un medio", "Efectivo", "Transferencia"]);

  await usuario.selectOptions(medio, "transferencia");
  await usuario.click(screen.getByRole("button", { name: "Registrar cobro" }));
  await vi.waitFor(() => {
    expect(
      servidor.pedidos.find((pedido) => pedido.clave === "POST /api/caja/cobros")?.cuerpo,
    ).toMatchObject({ cuotaId: SUR, medio: "transferencia" });
  });
});

it("genera la cuota desde el día elegido", async () => {
  const servidor = servidorFalso({
    "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }], {
      permisos: ["abonos.ver", "abonos.asignar", "personas.ver"],
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
    "GET /api/alumnos?buscar=Ana&pagina=1": {
      estado: 200,
      cuerpo: {
        pagina: 1,
        porPagina: 50,
        total: 1,
        elementos: [
          {
            id: ANA,
            nombre: "Ana",
            apellido: "Pérez",
            telefono: "2610000000",
            documento: null,
            email: null,
            fechaNacimiento: null,
            notas: "",
            activo: true,
            version: 1,
          },
        ],
      },
    },
    "POST /api/abonos/cuotas": {
      estado: 201,
      cuerpo: { id: SUR, monto: 30_000, desde: "2026-11-30", clases: 4 },
    },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Abonos" }));
  await usuario.click(await screen.findByText("Generar cuota"));
  await usuario.type(screen.getByLabelText("Buscar alumno"), "Ana");
  await usuario.click(await screen.findByRole("button", { name: "Ana Pérez" }));
  await usuario.type(screen.getByLabelText(/Empieza el/), "2026-11-30");
  await usuario.click(screen.getByRole("button", { name: "Confirmar cuota" }));
  await vi.waitFor(() => {
    expect(
      servidor.pedidos.find((pedido) => pedido.clave === "POST /api/abonos/cuotas")?.cuerpo,
    ).toEqual({ alumnoId: ANA, planId: PLAN, sedeId: NORTE, desde: "2026-11-30" });
  });
});
