// Permisos de una persona (0007): sus roles por sede y, por permiso, de dónde viene (rol, extra o
// quitado), con los cambios para quien gestiona usuarios. Las reglas las aplica la API.
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirEquipo,
  ANA,
  DOS_SEDES,
  GESTIONA,
  integrante,
  pagina,
  RECEPCION,
  VE,
} from "./equipo-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { CATALOGO, LISTA_DE_ROLES, PROFESOR, permisosDeAna } from "./roles-datos.ts";
import { servidorFalso, type Respuesta } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const NORTE_SOLO = [{ id: NORTE, nombre: "Norte" }];

function conPermisos(
  opciones: {
    permisos?: string[];
    sedeActiva?: string;
    sedes?: { id: string; nombre: string }[];
    enOtrasSedes?: boolean;
    extra?: Record<string, Respuesta>;
  } = {},
) {
  return servidorFalso({
    "GET /api/sesion": enCentro(opciones.sedes ?? NORTE_SOLO, {
      permisos: opciones.permisos ?? GESTIONA,
      ...(opciones.sedeActiva === undefined ? {} : { sedeActiva: opciones.sedeActiva }),
    }),
    "GET /api/equipo?pagina=1": pagina([integrante(ANA, "Ana")]),
    "GET /api/equipo/roles?pagina=1": LISTA_DE_ROLES,
    "GET /api/equipo/catalogo": CATALOGO,
    [`GET /api/equipo/${ANA}/permisos`]: permisosDeAna(opciones.enOtrasSedes),
    [`PUT /api/equipo/${ANA}/ajustes`]: { estado: 204 },
    [`DELETE /api/equipo/${ANA}/ajustes/${NORTE}/caja.anular`]: { estado: 204 },
    [`POST /api/equipo/${ANA}/asignaciones`]: { estado: 204 },
    [`DELETE /api/equipo/${ANA}/asignaciones/${NORTE}/${RECEPCION}`]: { estado: 204 },
    "PUT /api/sesion/sede": { estado: 204 },
    ...opciones.extra,
  });
}

async function abrirPermisosDeAna(usuario: UserEvent) {
  await abrirEquipo(usuario);
  const ana = await screen.findByRole("row", { name: /Ana/ });
  await usuario.click(within(ana).getByRole("button", { name: "Permisos" }));
  return screen.findByRole("region", { name: "Permisos de Ana" });
}

const fila = async (region: HTMLElement, permiso: string) =>
  within(region).findByRole("row", { name: new RegExp(permiso) });

describe("permisos de una persona", () => {
  it("muestra sus roles en la sede y el origen de cada permiso, con los ajustes destacados", async () => {
    conPermisos();
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    expect(within(region).getByRole("listitem").textContent).toContain("Recepción");
    expect((await fila(region, "Ver la caja")).textContent).toContain("Del rol Recepción");
    const cobrar = await fila(region, "Cobrar");
    expect(cobrar.textContent).toContain("Extra");
    expect(cobrar.dataset["ajuste"]).toBe("extra");
    const anular = await fila(region, "Anular pagos");
    expect(anular.textContent).toContain("Quitado (del rol Recepción)");
    expect(anular.textContent).toContain("No");
    expect((await fila(region, "Gestionar el equipo")).textContent).toContain("Sin acceso");
  });

  it("sin usuarios.gestionar no hay nada para cambiar", async () => {
    conPermisos({ permisos: VE });
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    await fila(region, "Cobrar");
    expect(
      within(region)
        .queryAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Cerrar"]);
  });

  it("quitar, dar como extra y volver al rol mandan el ajuste de esa sede", async () => {
    const servidor = conPermisos();
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    const ajustes = () =>
      servidor.pedidos.filter((p) => p.clave.includes("/ajustes")).map((p) => [p.clave, p.cuerpo]);
    await usuario.click(
      within(await fila(region, "Ver la caja")).getByRole("button", { name: "Quitar" }),
    );
    await usuario.click(
      within(await fila(region, "Gestionar el equipo")).getByRole("button", {
        name: "Dar como extra",
      }),
    );
    await usuario.click(
      within(await fila(region, "Anular pagos")).getByRole("button", { name: "Volver al rol" }),
    );
    await vi.waitFor(() => {
      expect(ajustes()).toHaveLength(3);
    });
    expect(ajustes()).toEqual([
      [`PUT /api/equipo/${ANA}/ajustes`, { sedeId: NORTE, permiso: "caja.ver", tipo: "quitado" }],
      [
        `PUT /api/equipo/${ANA}/ajustes`,
        { sedeId: NORTE, permiso: "usuarios.gestionar", tipo: "extra" },
      ],
      [`DELETE /api/equipo/${ANA}/ajustes/${NORTE}/caja.anular`, undefined],
    ]);
  });

  it("suma y quita roles en la sede", async () => {
    const servidor = conPermisos();
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    await usuario.selectOptions(await within(region).findByLabelText("Rol para sumar"), "Profesor");
    await usuario.click(within(region).getByRole("button", { name: "Sumar rol" }));
    await usuario.click(within(region).getByRole("button", { name: "Quitar rol" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.map((p) => p.clave)).toContain(
        `DELETE /api/equipo/${ANA}/asignaciones/${NORTE}/${RECEPCION}`,
      );
    });
    expect(
      servidor.pedidos.find((p) => p.clave === `POST /api/equipo/${ANA}/asignaciones`)?.cuerpo,
    ).toEqual({ sedeId: NORTE, rolId: PROFESOR });
  });

  it("muestra el error de la API tal cual", async () => {
    conPermisos({
      extra: {
        [`PUT /api/equipo/${ANA}/ajustes`]: {
          estado: 403,
          cuerpo: {
            error: {
              codigo: "persona-protegida",
              mensaje:
                "A un dueño o a la contaduría solo le cambia los permisos quien gestiona roles.",
            },
          },
        },
      },
    });
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    await usuario.click(
      within(await fila(region, "Ver la caja")).getByRole("button", { name: "Quitar" }),
    );
    expect((await within(region).findByRole("alert")).textContent).toBe(
      "A un dueño o a la contaduría solo le cambia los permisos quien gestiona roles.",
    );
  });
});

describe("con una sede activa", () => {
  it("si la persona tiene permisos en otras sedes, ofrece pasar a «Todas mis sedes»", async () => {
    const servidor = conPermisos({ sedes: DOS_SEDES, sedeActiva: NORTE, enOtrasSedes: true });
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    expect(
      (await within(region).findByText(/también tiene permisos en otras sedes/)).textContent,
    ).toBe(
      "Ana también tiene permisos en otras sedes. Para verlos y cambiarlos, pasá a «Todas mis sedes».",
    );
    await usuario.click(within(region).getByRole("button", { name: "Pasar a Todas mis sedes" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === "PUT /api/sesion/sede")?.cuerpo).toEqual({
        sede: "todas",
      });
    });
  });

  it("en «Todas mis sedes» no hay aviso, y se elige la sede", async () => {
    conPermisos({ sedes: DOS_SEDES, enOtrasSedes: true });
    const usuario = montarPanel();
    const region = await abrirPermisosDeAna(usuario);
    await fila(region, "Cobrar");
    expect(within(region).queryByRole("status")).toBeNull();
    expect(within(region).getByLabelText("Sede")).toBeDefined();
  });
});
