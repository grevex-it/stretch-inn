// La ficha del alumno con sus cuotas (0019): el profe anula un cobro desde ahí, sin caja.ver. Con
// solo personas.ver, la ficha se abre en solo lectura.
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirAlumnos, ANA, EDITA, LISTA, pagina, UNA_SEDE, VE } from "./alumnos-datos.ts";
import { enCentro, montarPanel, NORTE } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PLAN = "4b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f64";
const PAGO = "5b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f65";
const PAGADA = "6b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f66";
const IMPAGA = "9b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f69";
const CUOTAS = `GET /api/alumnos/${ANA}/cuotas?pagina=1`;

function cuota(id: string, desde: string, pagadaEn: string | null, pagoId: string | null) {
  const datos = { alumnoId: ANA, planId: PLAN, sedeId: NORTE, clases: 4, monto: 28_000 };
  return { id, ...datos, desde, pagadaEn, pagoId };
}

// Pagada el 2 de noviembre a las 2:30 UTC: en Buenos Aires todavía es el 1.
const CON_PAGO = pagina([
  cuota(PAGADA, "2026-11-02", "2026-11-02T02:30:00.000Z", PAGO),
  cuota(IMPAGA, "2026-10-05", null, null),
]);

function conFicha(permisos: string[], extra: Parameters<typeof servidorFalso>[0] = {}) {
  return servidorFalso({
    "GET /api/sesion": enCentro(UNA_SEDE, { permisos }),
    "GET /api/alumnos?pagina=1": LISTA,
    [CUOTAS]: CON_PAGO,
    ...extra,
  });
}

async function abrirFichaDeAna(usuario: UserEvent, boton: "Editar" | "Ver") {
  await abrirAlumnos(usuario);
  const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
  await usuario.click(within(ana).getByRole("button", { name: boton }));
}

const cuotas = () => screen.findByRole("region", { name: "Cuotas" });

describe("ficha en solo lectura", () => {
  it("con personas.ver y sin personas.editar, «Ver» la abre en solo lectura y no se puede guardar", async () => {
    const servidor = conFicha(VE);
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Ver");

    expect(await screen.findByRole("heading", { name: "Ficha de Ana Pérez" })).toBeDefined();
    const telefono = screen.getByLabelText<HTMLInputElement>("Teléfono");
    expect(telefono.value).toBe("11 5555-1234");
    expect(telefono.matches(":disabled")).toBe(true);
    await usuario.type(telefono, "9");
    expect(telefono.value).toBe("11 5555-1234");
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    expect(servidor.pedidos.some((p) => p.clave.startsWith("PUT"))).toBe(false);

    await usuario.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("heading", { name: "Ficha de Ana Pérez" })).toBeNull();
  });

  it("con personas.editar la fila ofrece «Editar» y no «Ver»", async () => {
    conFicha(EDITA);
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    expect(within(ana).getByRole("button", { name: "Editar" })).toBeDefined();
    expect(within(ana).queryByRole("button", { name: "Ver" })).toBeNull();
  });
});

describe("cuotas en la ficha", () => {
  it("con abonos.ver muestra las cuotas, con la fecha de pago en la zona del centro", async () => {
    conFicha([...VE, "abonos.ver"]);
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Ver");

    const lista = await cuotas();
    const [pagada, impaga] = await within(lista).findAllByRole("listitem");
    expect(pagada?.textContent).toMatch(/Desde el 02\/11\/2026 · 4 clases · .*28\.000/);
    expect(pagada?.textContent).toMatch(/Pagada el 01\/11\/2026/);
    expect(impaga?.textContent).toMatch(/Desde el 05\/10\/2026 · 4 clases · .*Impaga/);
  });

  it("también aparecen al entrar por «Editar»", async () => {
    conFicha([...EDITA, "abonos.ver"]);
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Editar");
    expect(await within(await cuotas()).findByText(/Pagada el 01\/11\/2026/)).toBeDefined();
  });

  it("sin abonos.ver no aparecen ni se piden", async () => {
    const servidor = conFicha(VE);
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Ver");
    await screen.findByRole("heading", { name: "Ficha de Ana Pérez" });
    expect(screen.queryByRole("region", { name: "Cuotas" })).toBeNull();
    expect(servidor.pedidos.some((p) => p.clave === CUOTAS)).toBe(false);
  });
});

describe("anular un cobro desde la ficha", () => {
  it("con caja.anular y sin caja.ver anula el pago de la cuota, y la cuota vuelve a impaga", async () => {
    const anulacion = `POST /api/caja/pagos/${PAGO}/anulacion`;
    const servidor = conFicha([...EDITA, "abonos.ver", "caja.anular"], {
      [anulacion]: { estado: 204 },
    });
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Editar");
    const lista = await cuotas();
    const [pagada, impaga] = await within(lista).findAllByRole("listitem");
    // Solo la cuota pagada se puede anular.
    expect(within(impaga as HTMLElement).queryByText("Anular pago")).toBeNull();

    await usuario.click(within(pagada as HTMLElement).getByText("Anular pago"));
    await usuario.type(screen.getByLabelText("Motivo de la anulación"), "Cobro repetido");
    // Anulado el pago, la API devuelve la cuota impaga y sin pago.
    servidor.responder(CUOTAS, pagina([cuota(PAGADA, "2026-11-02", null, null)]));
    await usuario.click(screen.getByRole("button", { name: "Confirmar anulación" }));

    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === anulacion)?.cuerpo).toEqual({
        motivo: "Cobro repetido",
      });
    });
    expect(await within(lista).findByText(/Impaga/)).toBeDefined();
    expect(within(lista).queryByText("Anular pago")).toBeNull();
    // Sin caja.ver no hay totales ni caja del día.
    expect(screen.queryByText(/Total/)).toBeNull();
    expect(servidor.pedidos.some((p) => p.clave.startsWith("GET /api/caja"))).toBe(false);
  });

  it("sin caja.anular se ven las cuotas pero no se ofrece anular", async () => {
    conFicha([...VE, "abonos.ver"]);
    const usuario = montarPanel();
    await abrirFichaDeAna(usuario, "Ver");
    const lista = await cuotas();
    await within(lista).findByText(/Pagada el/);
    expect(within(lista).queryByText("Anular pago")).toBeNull();
  });
});
