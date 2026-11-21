// BuscarAlumno (0018): un buscador con su etiqueta arriba y los resultados como filas que se
// eligen. Se prueba desde Caja > Cobrar cuota, una de las pantallas que lo usan.
import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ANA = "00000000-0000-4000-8000-0000000000aa";

it("el buscador se lee como búsqueda y cada resultado se elige con un botón", async () => {
  servidorFalso({
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
            numeroDeSocio: 54,
            fechaDeInicio: null,
            profeId: null,
            profeNombre: null,
            emergenciaNombre: null,
            emergenciaTelefono: null,
            activo: true,
            bajaEn: null,
            pendienteDeCompletar: false,
            version: 1,
          },
        ],
      },
    },
    [`GET /api/alumnos/${ANA}/cuotas?pagina=1`]: {
      estado: 200,
      cuerpo: { pagina: 1, porPagina: 50, total: 0, elementos: [] },
    },
  });
  const usuario = montarPanel();
  await usuario.click(await screen.findByRole("link", { name: "Caja" }));
  await usuario.click(await screen.findByText("Cobrar cuota"));

  const buscador = screen.getByRole("searchbox", { name: "Buscar alumno" });
  expect(buscador.getAttribute("maxlength")).toBe("100");
  await usuario.type(buscador, "Ana");
  await usuario.click(await screen.findByRole("button", { name: "Ana Pérez" }));

  expect(await screen.findByText("Cuotas de Ana Pérez")).toBeDefined();
});
