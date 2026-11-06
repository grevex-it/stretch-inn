// Pantalla Equipo: alta, clave temporal, bloqueo y reactivación.
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirEquipo,
  ANA,
  BEA,
  DOS_SEDES,
  GESTIONA,
  integrante,
  pagina,
  RECEPCION,
  ROLES,
} from "./equipo-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function conEquipo(extra: Record<string, Respuesta> = {}) {
  return servidorFalso({
    "GET /api/sesion": enCentro(DOS_SEDES, { permisos: GESTIONA }),
    "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana"), integrante(BEA, "Bea", false)]),
    "GET /api/equipo/roles?pagina=1": ROLES,
    ...extra,
  });
}

async function completarAlta(usuario: UserEvent) {
  await usuario.click(await screen.findByRole("button", { name: "Sumar persona" }));
  await usuario.type(screen.getByLabelText("Nombre"), "Caro");
  await usuario.type(screen.getByLabelText("Email"), "caro@ejemplo.com");
  await usuario.selectOptions(await screen.findByLabelText("Rol"), "Recepción");
  await usuario.click(screen.getByRole("checkbox", { name: "Norte" }));
  await usuario.click(screen.getByRole("button", { name: "Sumar" }));
}

describe("sumar persona", () => {
  it("manda el alta y muestra la clave temporal una vez, para pasársela", async () => {
    const servidor = conEquipo({
      "POST /api/equipo": {
        estado: 201,
        cuerpo: { usuarioId: ANA, claveTemporal: "abcd-efgh-jkmn" },
      },
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    await completarAlta(usuario);

    const clave = await screen.findByRole("region", { name: "Clave temporal de Caro" });
    expect(within(clave).getByText("abcd-efgh-jkmn")).toBeDefined();
    expect(within(clave).getByText(/no la vamos a volver a mostrar/)).toBeDefined();
    expect(servidor.pedidos.find((p) => p.clave === "POST /api/equipo")?.cuerpo).toEqual({
      nombre: "Caro",
      email: "caro@ejemplo.com",
      rolId: RECEPCION,
      sedeIds: [NORTE],
    });
    await usuario.click(within(clave).getByRole("button", { name: "Listo" }));
    expect(screen.queryByRole("region", { name: "Clave temporal de Caro" })).toBeNull();
    expect(servidor.pedidos.filter((p) => p.clave === "GET /api/equipo?pagina=1")).toHaveLength(2);
  });

  it("si el email ya tenía cuenta, avisa que entra con su contraseña de siempre", async () => {
    conEquipo({
      "POST /api/equipo": { estado: 201, cuerpo: { usuarioId: ANA, claveTemporal: null } },
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    await completarAlta(usuario);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Caro ya tenía cuenta: entra con su contraseña de siempre.",
    );
  });

  it("muestra el error de la API tal cual", async () => {
    conEquipo({
      "POST /api/equipo": {
        estado: 409,
        cuerpo: {
          error: {
            codigo: "ya-es-del-equipo",
            mensaje: "Esa persona ya es del equipo del centro.",
          },
        },
      },
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    await completarAlta(usuario);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Esa persona ya es del equipo del centro.",
    );
  });
});

describe("acciones de cada persona", () => {
  it("nueva clave temporal: pide confirmación y muestra la clave", async () => {
    const servidor = conEquipo({
      [`POST /api/equipo/${ANA}/clave`]: {
        estado: 200,
        cuerpo: { claveTemporal: "pqrs-tuvw-xyz2" },
      },
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const ana = await screen.findByRole("row", { name: /Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Nueva clave temporal" }));
    expect(within(ana).getByText(/Su contraseña actual deja de servir/)).toBeDefined();

    await usuario.click(within(ana).getByRole("button", { name: "Sí, generar" }));

    const clave = await screen.findByRole("region", { name: "Clave temporal de Ana" });
    expect(within(clave).getByText("pqrs-tuvw-xyz2")).toBeDefined();
    expect(servidor.pedidos.some((p) => p.clave === `POST /api/equipo/${ANA}/clave`)).toBe(true);
  });

  it("bloquear pide confirmación; cancelar no manda nada", async () => {
    const servidor = conEquipo({ [`PUT /api/equipo/${ANA}/bloqueo`]: { estado: 204 } });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const ana = await screen.findByRole("row", { name: /Ana/ });

    await usuario.click(within(ana).getByRole("button", { name: "Bloquear" }));
    expect(within(ana).getByText(/Sale del sistema en el momento/)).toBeDefined();
    await usuario.click(within(ana).getByRole("button", { name: "Cancelar" }));
    expect(servidor.pedidos.some((p) => p.clave.startsWith("PUT"))).toBe(false);

    await usuario.click(within(ana).getByRole("button", { name: "Bloquear" }));
    await usuario.click(within(ana).getByRole("button", { name: "Sí, bloquear" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.some((p) => p.clave === `PUT /api/equipo/${ANA}/bloqueo`)).toBe(true);
    });
  });

  it("reactivar no pide confirmación", async () => {
    const servidor = conEquipo({ [`DELETE /api/equipo/${BEA}/bloqueo`]: { estado: 204 } });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const bea = await screen.findByRole("row", { name: /Bea/ });
    await usuario.click(within(bea).getByRole("button", { name: "Reactivar" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.some((p) => p.clave === `DELETE /api/equipo/${BEA}/bloqueo`)).toBe(
        true,
      );
    });
  });

  it("si la API no deja, muestra su motivo en la fila", async () => {
    conEquipo({
      [`PUT /api/equipo/${ANA}/bloqueo`]: {
        estado: 403,
        cuerpo: {
          error: { codigo: "mas-permisos", mensaje: "Solo con alguien con menos permisos." },
        },
      },
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const ana = await screen.findByRole("row", { name: /Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Bloquear" }));
    await usuario.click(within(ana).getByRole("button", { name: "Sí, bloquear" }));
    expect((await within(ana).findByRole("alert")).textContent).toBe(
      "Solo con alguien con menos permisos.",
    );
  });
});
