// Antecedentes y patologías en la ficha del alumno: aparte de los datos, con sus permisos (0019).
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirAlumnos,
  ANA,
  EDITA,
  EDITA_SALUD,
  LISTA,
  PROFES,
  SALUD,
  UNA_SEDE,
} from "./alumnos-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const RUTA = `/api/alumnos/${ANA}/salud`;
const CARGADA = { estado: 200, cuerpo: { patologias: "Escoliosis.", version: 3 } };

function conSalud(
  permisos: string[],
  extra: Record<string, Respuesta | ((c: unknown) => Respuesta)> = {},
) {
  return servidorFalso({
    "GET /api/sesion": enCentro(UNA_SEDE, { permisos }),
    "GET /api/alumnos?pagina=1": LISTA,
    "GET /api/alumnos/profes?pagina=1": PROFES,
    [`GET ${RUTA}`]: CARGADA,
    ...extra,
  });
}

async function abrirAna(boton: "Editar" | "Ver") {
  const usuario = montarPanel();
  await abrirAlumnos(usuario);
  const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
  await usuario.click(within(ana).getByRole("button", { name: boton }));
  return usuario;
}

const patologias = () => screen.getByLabelText<HTMLTextAreaElement>("Antecedentes y patologías");

describe("antecedentes y patologías", () => {
  it("sin personas.ver-salud no aparecen ni se piden", async () => {
    const servidor = conSalud(EDITA);
    await abrirAna("Editar");
    await screen.findByRole("heading", { name: "Editar a Ana Pérez" });
    expect(screen.queryByRole("heading", { name: "Salud" })).toBeNull();
    expect(servidor.pedidos.some((p) => p.clave === `GET ${RUTA}`)).toBe(false);
  });

  it("con personas.ver-salud se ven, sin poder guardarlas", async () => {
    conSalud(["personas.ver", ...SALUD]);
    await abrirAna("Ver");
    await vi.waitFor(() => {
      expect(patologias().value).toBe("Escoliosis.");
    });
    expect(patologias().disabled).toBe(true);
    // Etiqueta visible arriba del campo, como el resto de la ficha (0018).
    expect(screen.getByText("Antecedentes y patologías", { selector: "label" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Salud" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Guardar antecedentes" })).toBeNull();
  });

  it("con personas.editar-salud se guardan con la versión que se vio", async () => {
    const servidor = conSalud([...EDITA, ...EDITA_SALUD], {
      [`PUT ${RUTA}`]: { estado: 200, cuerpo: { version: 4 } },
    });
    const usuario = await abrirAna("Editar");
    await vi.waitFor(() => {
      expect(patologias().value).toBe("Escoliosis.");
    });
    await usuario.type(patologias(), " Hernia de disco.");
    await usuario.click(screen.getByRole("button", { name: "Guardar antecedentes" }));

    expect((await screen.findByText("Guardamos los antecedentes.")).getAttribute("role")).toBe(
      "status",
    );
    expect(servidor.pedidos.find((p) => p.clave === `PUT ${RUTA}`)?.cuerpo).toEqual({
      patologias: "Escoliosis. Hernia de disco.",
      version: 3,
    });
    expect(servidor.pedidos.some((p) => p.clave === `PUT /api/alumnos/${ANA}`)).toBe(false);
  });

  it("si otra persona las cambió en el medio, muestra lo de ahora y aparte lo que se había escrito", async () => {
    const servidor = conSalud([...EDITA, ...EDITA_SALUD], {
      [`PUT ${RUTA}`]: (pedido) =>
        (pedido as { version: number }).version === 4
          ? { estado: 200, cuerpo: { version: 5 } }
          : {
              estado: 409,
              cuerpo: {
                error: {
                  codigo: "cambio-concurrente",
                  mensaje: "Esta ficha cambió. Volvé a cargarla.",
                },
              },
            },
    });
    const usuario = await abrirAna("Editar");
    await vi.waitFor(() => {
      expect(patologias().value).toBe("Escoliosis.");
    });
    // Otra persona los guardó en el medio: desde ahora la API devuelve la versión 4.
    servidor.responder(`GET ${RUTA}`, {
      estado: 200,
      cuerpo: { patologias: "Escoliosis. Operada en 2024.", version: 4 },
    });
    await usuario.type(patologias(), " Hernia de disco.");
    await usuario.click(screen.getByRole("button", { name: "Guardar antecedentes" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Esta ficha cambió. Volvé a cargarla.",
    );
    await vi.waitFor(() => {
      expect(patologias().value).toBe("Escoliosis. Operada en 2024.");
    });
    const escrito = screen.getByRole("region", { name: "Lo que habías escrito" });
    expect(within(escrito).getByText("Escoliosis. Hernia de disco.")).toBeDefined();

    await usuario.type(patologias(), " Hernia de disco.");
    await usuario.click(screen.getByRole("button", { name: "Guardar antecedentes" }));
    expect(await screen.findByText("Guardamos los antecedentes.")).toBeDefined();
    expect(screen.queryByRole("region", { name: "Lo que habías escrito" })).toBeNull();
    expect(servidor.pedidos.filter((p) => p.clave === `PUT ${RUTA}`).map((p) => p.cuerpo)).toEqual([
      { patologias: "Escoliosis. Hernia de disco.", version: 3 },
      { patologias: "Escoliosis. Operada en 2024. Hernia de disco.", version: 4 },
    ]);
  });
});
