// Pantalla Roles (0007): la lista con las plantillas, duplicar, editar con los atajos por sección y
// borrar. Las reglas las aplica la API: acá se prueba lo que ve y manda la persona.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOS_SEDES, GESTIONA, integrante, pagina, ANA } from "./equipo-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import {
  abrirRoles,
  CATALOGO,
  ficha,
  GESTIONA_ROLES,
  LISTA_DE_ROLES,
  PROFESOR,
  PROPIO,
} from "./roles-datos.ts";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function conRoles(extra: Record<string, Respuesta> = {}, permisos = GESTIONA_ROLES) {
  return servidorFalso({
    "GET /api/sesion": enCentro(DOS_SEDES, { permisos }),
    "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana")]),
    "GET /api/equipo/roles?pagina=1": LISTA_DE_ROLES,
    "GET /api/equipo/catalogo": CATALOGO,
    [`GET /api/equipo/roles/${PROFESOR}`]: ficha(PROFESOR, "Profesor", "profesor", [
      "caja.ver",
      "caja.cobrar",
    ]),
    [`GET /api/equipo/roles/${PROPIO}`]: ficha(PROPIO, "Profe sin bajas", null, ["caja.cobrar"]),
    ...extra,
  });
}

const casilla = (nombre: string) =>
  screen.getByRole<HTMLInputElement>("checkbox", { name: nombre });

describe("la lista de roles", () => {
  it("se entra desde Equipo solo con roles.gestionar", async () => {
    conRoles({}, GESTIONA);
    const usuario = montarPanel();
    await usuario.click(await screen.findByRole("link", { name: "Equipo" }));
    await screen.findByRole("row", { name: /Ana/ });
    expect(screen.queryByRole("link", { name: "Roles" })).toBeNull();
  });

  it("las plantillas se ven y se duplican; los propios, también se editan y se borran", async () => {
    conRoles();
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const profesor = await screen.findByRole("row", { name: /Profesor/ });
    expect(within(profesor).getByText("Plantilla")).toBeDefined();
    const botones = (fila: HTMLElement) =>
      within(fila)
        .getAllByRole("button")
        .map((b) => b.textContent);
    expect(botones(profesor)).toEqual(["Ver", "Duplicar"]);
    expect(botones(screen.getByRole("row", { name: /Profe sin bajas/ }))).toEqual([
      "Editar",
      "Duplicar",
      "Borrar",
    ]);
  });

  it("una plantilla se abre en solo lectura", async () => {
    conRoles();
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const profesor = await screen.findByRole("row", { name: /Profesor/ });
    await usuario.click(within(profesor).getByRole("button", { name: "Ver" }));
    await screen.findByRole("heading", { name: "Profesor" });
    expect(casilla("Cobrar").checked).toBe(true);
    expect(casilla("Cobrar").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
  });
});

describe("el editor de un rol", () => {
  it("duplicar arma una copia con los mismos permisos y la crea", async () => {
    const servidor = conRoles({
      "POST /api/equipo/roles": { estado: 201, cuerpo: { id: PROPIO } },
    });
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const profesor = await screen.findByRole("row", { name: /Profesor/ });
    await usuario.click(within(profesor).getByRole("button", { name: "Duplicar" }));
    const nombre = await screen.findByLabelText<HTMLInputElement>("Nombre del rol");
    expect(nombre.value).toBe("Copia de Profesor");
    await usuario.click(casilla("Ver el equipo"));
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("status");
    expect(servidor.pedidos.find((p) => p.clave === "POST /api/equipo/roles")?.cuerpo).toEqual({
      nombre: "Copia de Profesor",
      permisos: ["usuarios.ver", "caja.ver", "caja.cobrar"],
    });
  });

  it("los atajos de cada sección: sin acceso, ver y operar", async () => {
    const servidor = conRoles({
      [`PUT /api/equipo/roles/${PROPIO}`]: { estado: 200, cuerpo: { version: 4 } },
    });
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const propio = await screen.findByRole("row", { name: /Profe sin bajas/ });
    await usuario.click(within(propio).getByRole("button", { name: "Editar" }));
    const caja = await screen.findByLabelText<HTMLSelectElement>("Acceso a Caja");
    expect(caja.value).toBe("personalizado");
    await usuario.selectOptions(caja, "Ver");
    expect([casilla("Ver la caja").checked, casilla("Cobrar").checked]).toEqual([true, false]);
    await usuario.selectOptions(caja, "Sin acceso");
    expect(casilla("Ver la caja").checked).toBe(false);
    await usuario.selectOptions(caja, "Operar");
    expect(casilla("Anular pagos").checked).toBe(true);
    await usuario.selectOptions(screen.getByLabelText("Acceso a Equipo"), "Ver");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("status");
    expect(
      servidor.pedidos.find((p) => p.clave === `PUT /api/equipo/roles/${PROPIO}`)?.cuerpo,
    ).toEqual({
      nombre: "Profe sin bajas",
      permisos: ["usuarios.ver", "caja.ver", "caja.cobrar", "caja.anular"],
      version: 3,
    });
  });

  it("si otro lo cambió mientras tanto, muestra el aviso de la API", async () => {
    conRoles({
      [`PUT /api/equipo/roles/${PROPIO}`]: {
        estado: 409,
        cuerpo: {
          error: {
            codigo: "cambio-concurrente",
            mensaje: "Alguien cambió el rol mientras lo editabas. Volvé a abrirlo.",
          },
        },
      },
    });
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const propio = await screen.findByRole("row", { name: /Profe sin bajas/ });
    await usuario.click(within(propio).getByRole("button", { name: "Editar" }));
    await usuario.click(await screen.findByRole("button", { name: "Guardar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Alguien cambió el rol mientras lo editabas. Volvé a abrirlo.",
    );
  });
});

describe("borrar un rol", () => {
  it("pide confirmación y, si alguien lo tiene, muestra quiénes", async () => {
    const servidor = conRoles({
      [`DELETE /api/equipo/roles/${PROPIO}`]: {
        estado: 409,
        cuerpo: {
          error: {
            codigo: "rol-en-uso",
            mensaje: "Lo tienen Ana y Rita: cambiales el rol antes de borrarlo.",
          },
        },
      },
    });
    const usuario = montarPanel();
    await abrirRoles(usuario);
    const propio = await screen.findByRole("row", { name: /Profe sin bajas/ });
    await usuario.click(within(propio).getByRole("button", { name: "Borrar" }));
    expect(within(propio).getByText(/¿Borrar el rol Profe sin bajas\?/)).toBeDefined();
    await usuario.click(within(propio).getByRole("button", { name: "Sí, borrar" }));
    expect((await within(propio).findByRole("alert")).textContent).toBe(
      "Lo tienen Ana y Rita: cambiales el rol antes de borrarlo.",
    );
    expect(servidor.pedidos.map((p) => p.clave)).toContain(`DELETE /api/equipo/roles/${PROPIO}`);
  });
});
