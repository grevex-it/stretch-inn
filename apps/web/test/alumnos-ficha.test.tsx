// Pantalla Alumnos: alta, edición y baja.
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirAlumnos, ANA, BEA, EDITA, LISTA, UNA_SEDE } from "./alumnos-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function conAlumnos(extra: Record<string, Respuesta> = {}) {
  return servidorFalso({
    "GET /api/sesion": enCentro(UNA_SEDE, { permisos: EDITA }),
    "GET /api/alumnos?pagina=1": LISTA,
    ...extra,
  });
}

const cuerpo = (servidor: ReturnType<typeof conAlumnos>, clave: string) =>
  servidor.pedidos.find((p) => p.clave === clave)?.cuerpo;

async function completarAlta(usuario: UserEvent) {
  await usuario.click(await screen.findByRole("button", { name: "Sumar alumno" }));
  await usuario.type(screen.getByLabelText("Nombre"), "Caro");
  await usuario.type(screen.getByLabelText("Apellido"), "Gómez");
  await usuario.type(screen.getByLabelText("Teléfono"), "11 4444-0000");
  await usuario.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("sumar alumno", () => {
  it("con lo obligatorio alcanza: lo opcional viaja vacío y la lista se actualiza", async () => {
    const servidor = conAlumnos({ "POST /api/alumnos": { estado: 201, cuerpo: { id: ANA } } });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await completarAlta(usuario);

    expect((await screen.findByRole("status")).textContent).toBe("Guardamos a Caro Gómez.");
    expect(cuerpo(servidor, "POST /api/alumnos")).toEqual({
      nombre: "Caro",
      apellido: "Gómez",
      telefono: "11 4444-0000",
      documento: "",
      email: "",
      fechaNacimiento: "",
      notas: "",
    });
    expect(screen.queryByRole("heading", { name: "Sumar alumno" })).toBeNull();
    expect(servidor.pedidos.filter((p) => p.clave === "GET /api/alumnos?pagina=1")).toHaveLength(2);
  });

  it("muestra el error de la API tal cual y no cierra el formulario", async () => {
    conAlumnos({
      "POST /api/alumnos": {
        estado: 409,
        cuerpo: {
          error: { codigo: "documento-repetido", mensaje: "Ya hay un alumno con ese documento." },
        },
      },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await completarAlta(usuario);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ya hay un alumno con ese documento.",
    );
    expect(screen.getByRole("heading", { name: "Sumar alumno" })).toBeDefined();
  });
});

describe("editar", () => {
  it("abre la ficha con sus datos y manda el cambio con la versión que vio", async () => {
    const servidor = conAlumnos({
      [`PUT /api/alumnos/${ANA}`]: { estado: 200, cuerpo: { version: 2 } },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Editar" }));

    const telefono = screen.getByLabelText("Teléfono");
    expect((telefono as HTMLInputElement).value).toBe("11 5555-1234");
    await usuario.clear(telefono);
    await usuario.type(telefono, "11 4444-0000");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    await vi.waitFor(() => {
      expect(cuerpo(servidor, `PUT /api/alumnos/${ANA}`)).toMatchObject({
        telefono: "11 4444-0000",
        documento: "30123456",
        version: 1,
      });
    });
  });
});

describe("dar de baja y reactivar", () => {
  it("dar de baja pide confirmación; cancelar no manda nada", async () => {
    const servidor = conAlumnos({ [`PUT /api/alumnos/${ANA}/baja`]: { estado: 204 } });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });

    await usuario.click(within(ana).getByRole("button", { name: "Dar de baja" }));
    expect(within(ana).getByText(/Deja de aparecer en la lista/)).toBeDefined();
    await usuario.click(within(ana).getByRole("button", { name: "Cancelar" }));
    expect(servidor.pedidos.some((p) => p.clave.startsWith("PUT"))).toBe(false);

    await usuario.click(within(ana).getByRole("button", { name: "Dar de baja" }));
    await usuario.click(within(ana).getByRole("button", { name: "Sí, dar de baja" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.some((p) => p.clave === `PUT /api/alumnos/${ANA}/baja`)).toBe(true);
    });
  });

  it("reactivar no pide confirmación", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: EDITA }),
      "GET /api/alumnos?pagina=1": LISTA,
      "GET /api/alumnos?pagina=1&bajas=si": {
        estado: 200,
        cuerpo: {
          pagina: 1,
          porPagina: 50,
          total: 1,
          elementos: [{ ...(LISTA.cuerpo.elementos[1] ?? {}), id: BEA, activo: false }],
        },
      },
      [`DELETE /api/alumnos/${BEA}/baja`]: { estado: 204 },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(screen.getByRole("checkbox", { name: "Mostrar bajas" }));
    const bea = await screen.findByRole("row", { name: /Zapata, Bea/ });
    await usuario.click(within(bea).getByRole("button", { name: "Reactivar" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.some((p) => p.clave === `DELETE /api/alumnos/${BEA}/baja`)).toBe(
        true,
      );
    });
  });
});
