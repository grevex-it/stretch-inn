// Pantalla Alumnos: cómo se llega, la lista, el buscador, las bajas y la paginación.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirAlumnos,
  alumno,
  ANA,
  BEA,
  EDITA,
  LISTA,
  pagina,
  UNA_SEDE,
  VE,
} from "./alumnos-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navegación", () => {
  it("con permiso para ver alumnos, el menú ofrece Alumnos", async () => {
    servidorFalso({ "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }) });
    montarPanel();
    const menu = await screen.findByRole("navigation", { name: "Secciones" });
    expect(within(menu).getByRole("link", { name: "Alumnos" })).toBeDefined();
  });

  it("sin ese permiso, Alumnos no aparece", async () => {
    servidorFalso({ "GET /api/sesion": enCentro(UNA_SEDE) });
    montarPanel();
    const menu = await screen.findByRole("navigation", { name: "Secciones" });
    expect(within(menu).queryByRole("link", { name: "Alumnos" })).toBeNull();
  });
});

describe("lista", () => {
  it("muestra apellido y nombre, teléfono, documento y estado", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": LISTA,
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    expect(within(ana).getByText("11 5555-1234")).toBeDefined();
    expect(within(ana).getByText("30123456")).toBeDefined();
    expect(within(ana).getByText("Activo")).toBeDefined();
  });

  it("quien solo ve no tiene botones para cambiar nada", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": LISTA,
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    expect(within(ana).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Sumar alumno" })).toBeNull();
  });

  it("quien edita tiene «Sumar alumno», «Editar» y «Dar de baja»", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: EDITA }),
      "GET /api/alumnos?pagina=1": LISTA,
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    expect(
      within(ana)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Editar", "Dar de baja"]);
    expect(screen.getByRole("button", { name: "Sumar alumno" })).toBeDefined();
  });

  it("sin alumnos lo dice, en vez de mostrar una tabla vacía", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": pagina([]),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    expect(await screen.findByText("Todavía no hay alumnos cargados.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("buscador, bajas y páginas", () => {
  it("busca al enviar y vuelve a la página 1", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": LISTA,
      "GET /api/alumnos?pagina=1&buscar=p%C3%A9rez%20ana": pagina([alumno(ANA, "Ana", "Pérez")]),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.type(screen.getByLabelText("Buscar"), "pérez ana{Enter}");
    await vi.waitFor(() => {
      expect(screen.queryByRole("row", { name: /Zapata, Bea/ })).toBeNull();
    });
    expect(servidor.pedidos.some((p) => p.clave.includes("buscar=p%C3%A9rez%20ana"))).toBe(true);
  });

  it("si la búsqueda no encuentra a nadie, lo dice", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": LISTA,
      "GET /api/alumnos?pagina=1&buscar=xyz": pagina([]),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.type(screen.getByLabelText("Buscar"), "xyz{Enter}");
    expect(await screen.findByText("No encontramos alumnos con «xyz».")).toBeDefined();
  });

  it("«Mostrar bajas» pide también las bajas, que se ven como «De baja»", async () => {
    servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: EDITA }),
      "GET /api/alumnos?pagina=1": LISTA,
      "GET /api/alumnos?pagina=1&bajas=si": pagina([alumno(ANA, "Ana", "Pérez", false)]),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(screen.getByRole("checkbox", { name: "Mostrar bajas" }));
    const ana = await screen.findByRole("row", { name: /De baja/ });
    expect(within(ana).getByRole("button", { name: "Reactivar" })).toBeDefined();
  });

  it("pagina de a 50: «Siguiente» pide la página 2", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": enCentro(UNA_SEDE, { permisos: VE }),
      "GET /api/alumnos?pagina=1": pagina([alumno(ANA, "Ana", "Pérez")], 51),
      "GET /api/alumnos?pagina=2": pagina([alumno(BEA, "Bea", "Zapata")], 51, 2),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    expect(await screen.findByText("Página 1 de 2")).toBeDefined();
    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("row", { name: /Zapata, Bea/ })).toBeDefined();
    expect(servidor.pedidos.some((p) => p.clave === "GET /api/alumnos?pagina=2")).toBe(true);
  });
});
