// La estructura del panel: centro y sede activa, aviso de sede cambiada, salir y sesión vencida.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enCentro, montarPanel, NORTE, SIN_SESION, SUR } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const DOS_SEDES = [
  { id: NORTE, nombre: "Norte" },
  { id: SUR, nombre: "Sur" },
];

describe("selector de sede", () => {
  it("con varias sedes ofrece «Todas mis sedes» y cada sede, y cambia la activa", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES),
      "PUT /api/sesion/sede": { estado: 204 },
    });
    const usuario = montarPanel();
    const selector = await screen.findByLabelText("Sede");
    const opciones = within(selector)
      .getAllByRole("option")
      .map((opcion) => opcion.textContent);
    expect(opciones).toEqual(["Todas mis sedes", "Norte", "Sur"]);

    await usuario.selectOptions(selector, SUR);
    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === "PUT /api/sesion/sede")?.cuerpo).toEqual({
        sede: SUR,
      });
    });
  });

  it("con una sola sede no aparece el selector: muestra su nombre", async () => {
    servidorFalso({ "GET /api/sesion": enCentro([{ id: NORTE, nombre: "Norte" }]) });
    montarPanel();
    expect(await screen.findByText("Norte")).toBeDefined();
    expect(screen.queryByLabelText("Sede")).toBeNull();
  });

  it("si le quitaron la sede que tenía, avisa a cuál lo pasó", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { sedeActiva: NORTE, sedeCambiada: true }),
    });
    montarPanel();
    expect((await screen.findByRole("status")).textContent).toMatch(
      /Ya no tenés permisos en la sede que tenías elegida\. Ahora estás en Norte\./,
    );
  });
});

describe("centro", () => {
  it("con varios centros puede cambiar de centro sin volver a entrar", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { centros: 2 }),
      "PUT /api/sesion/centro": { estado: 204 },
    });
    const usuario = montarPanel();
    await usuario.selectOptions(await screen.findByLabelText("Centro"), "Centro Dos");
    await vi.waitFor(() => {
      expect(servidor.pedidos.some((p) => p.clave === "PUT /api/sesion/centro")).toBe(true);
    });
  });
});

describe("salir y sesión vencida", () => {
  it("salir cierra la sesión y vuelve al login", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES),
      "DELETE /api/sesion": { estado: 204 },
    });
    const usuario = montarPanel();
    await usuario.click(await screen.findByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeDefined();
    expect(servidor.pedidos.some((p) => p.clave === "DELETE /api/sesion")).toBe(true);
  });

  it("si la API dice que la sesión terminó, vuelve al login", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES),
      "PUT /api/sesion/sede": SIN_SESION,
    });
    const usuario = montarPanel();
    await usuario.selectOptions(await screen.findByLabelText("Sede"), SUR);
    servidor.responder("GET /api/sesion", SIN_SESION);
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeDefined();
  });
});
