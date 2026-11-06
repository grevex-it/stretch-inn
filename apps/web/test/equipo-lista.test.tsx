// Pantalla Equipo: cómo se llega, qué muestra según los permisos y la paginación.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirEquipo,
  ANA,
  BEA,
  DOS_SEDES,
  GESTIONA,
  integrante,
  pagina,
  VE,
} from "./equipo-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navegación", () => {
  it("con permiso para ver el equipo, el menú lo ofrece junto a Inicio", async () => {
    servidorFalso({ "GET /api/sesion": enCentro(DOS_SEDES, { permisos: VE }) });
    montarPanel();
    const menu = await screen.findByRole("navigation", { name: "Secciones" });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Inicio", "Equipo"]);
  });

  it("sin ese permiso, Equipo no aparece", async () => {
    servidorFalso({ "GET /api/sesion": enCentro(DOS_SEDES) });
    montarPanel();
    const menu = await screen.findByRole("navigation", { name: "Secciones" });
    expect(within(menu).queryByRole("link", { name: "Equipo" })).toBeNull();
  });
});

describe("lista del equipo", () => {
  it("muestra nombre, email, roles por sede y estado con palabras", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { permisos: VE }),
      "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana"), integrante(BEA, "Bea", false)]),
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);

    const ana = await screen.findByRole("row", { name: /Ana/ });
    expect(within(ana).getByText("ana@ejemplo.com")).toBeDefined();
    expect(within(ana).getByText("Recepción en Norte")).toBeDefined();
    expect(within(ana).getByText("Activo")).toBeDefined();
    expect(within(screen.getByRole("row", { name: /Bea/ })).getByText("Bloqueado")).toBeDefined();
  });

  it("quien solo ve el equipo no tiene botones para cambiarlo", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { permisos: VE }),
      "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana")]),
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const ana = await screen.findByRole("row", { name: /Ana/ });
    expect(within(ana).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Sumar persona" })).toBeNull();
  });

  it("quien gestiona tiene «Sumar persona» y las acciones de cada fila", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { permisos: GESTIONA }),
      "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana"), integrante(BEA, "Bea", false)]),
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    const ana = await screen.findByRole("row", { name: /Ana/ });
    expect(
      within(ana)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Nueva clave temporal", "Bloquear"]);
    const bea = screen.getByRole("row", { name: /Bea/ });
    expect(within(bea).getByRole("button", { name: "Reactivar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Sumar persona" })).toBeDefined();
  });

  it("pagina de a 50: «Siguiente» pide la página 2", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(DOS_SEDES, { permisos: VE }),
      "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana")], 51),
      "GET /api/equipo?pagina=2": pagina([integrante(BEA, "Bea")], 51, 2),
    });
    const usuario = montarPanel();
    await abrirEquipo(usuario);
    expect(await screen.findByText("Página 1 de 2")).toBeDefined();

    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByRole("row", { name: /Bea/ })).toBeDefined();
    expect(screen.getByText("Página 2 de 2")).toBeDefined();
    expect(servidor.pedidos.some((p) => p.clave === "GET /api/equipo?pagina=2")).toBe(true);
  });
});
