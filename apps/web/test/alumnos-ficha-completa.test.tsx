// La ficha completa del alumno: número de socio, inicio, profe y contacto de emergencia (0019,
// 0022), con el email opcional al final. Al sumar un alumno, la ficha queda abierta en él.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abrirAlumnos,
  alumno,
  ANA,
  EDITA,
  EDITA_SALUD,
  GESTIONA,
  LISTA,
  LORE,
  pagina,
  PROFES,
  UNA_SEDE,
  VE,
} from "./alumnos-datos.ts";
import { enCentro, montarPanel } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CARO = "cb0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f6c";
const COMPLETA = {
  ...alumno(ANA, "Ana", "Pérez"),
  numeroDeSocio: 283,
  fechaDeInicio: "2024-03-01",
  profeId: LORE,
  profeNombre: "Lore",
  emergenciaNombre: "Marta (madre)",
  emergenciaTelefono: "11 4444-5555",
};

function conAlumnos(permisos: string[], extra: Parameters<typeof servidorFalso>[0] = {}) {
  return servidorFalso({
    "GET /api/sesion": enCentro(UNA_SEDE, { permisos }),
    "GET /api/alumnos?pagina=1": pagina([COMPLETA]),
    "GET /api/alumnos/profes?pagina=1": PROFES,
    ...extra,
  });
}

const valor = (etiqueta: string) => screen.getByLabelText<HTMLInputElement>(etiqueta).value;

describe("sumar alumno con la ficha completa", () => {
  it("manda número de socio, inicio, profe y contacto, y la ficha queda abierta en el alumno", async () => {
    const servidor = conAlumnos([...GESTIONA, ...EDITA_SALUD], {
      "GET /api/alumnos?pagina=1": LISTA,
      "POST /api/alumnos": { estado: 201, cuerpo: { id: CARO } },
      [`GET /api/alumnos/${CARO}`]: {
        estado: 200,
        cuerpo: { ...COMPLETA, id: CARO, nombre: "Caro", apellido: "Gómez" },
      },
      [`GET /api/alumnos/${CARO}/salud`]: { estado: 200, cuerpo: { patologias: "", version: 0 } },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(await screen.findByRole("button", { name: "Sumar alumno" }));
    expect(screen.queryByRole("heading", { name: "Salud" })).toBeNull();

    await usuario.type(screen.getByLabelText("Nombre"), "Caro");
    await usuario.type(screen.getByLabelText("Apellido"), "Gómez");
    await usuario.type(screen.getByLabelText("Teléfono"), "11 4444-0000");
    await usuario.type(screen.getByLabelText("Número de socio"), "283");
    await usuario.type(screen.getByLabelText("Fecha de inicio"), "2024-03-01");
    await usuario.selectOptions(await screen.findByLabelText("Profe"), "Lore");
    await usuario.type(screen.getByLabelText("Contacto de emergencia"), "Marta (madre)");
    await usuario.type(screen.getByLabelText("Teléfono de emergencia"), "11 4444-5555");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("heading", { name: "Editar a Caro Gómez" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Guardamos a Caro Gómez.");
    expect(servidor.pedidos.find((p) => p.clave === "POST /api/alumnos")?.cuerpo).toEqual({
      nombre: "Caro",
      apellido: "Gómez",
      telefono: "11 4444-0000",
      documento: "",
      fechaNacimiento: "",
      numeroDeSocio: 283,
      fechaDeInicio: "2024-03-01",
      profeId: LORE,
      emergenciaNombre: "Marta (madre)",
      emergenciaTelefono: "11 4444-5555",
      notas: "",
      email: "",
    });
    expect(await screen.findByRole("heading", { name: "Salud" })).toBeDefined();
  });

  it("sin número de socio no lo manda (lo pone la API) y sin profe manda null", async () => {
    const servidor = conAlumnos(EDITA, {
      "POST /api/alumnos": { estado: 201, cuerpo: { id: CARO } },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(await screen.findByRole("button", { name: "Sumar alumno" }));
    expect((await screen.findByRole("option", { name: "Sin profe" })).getAttribute("value")).toBe(
      "",
    );
    await usuario.type(screen.getByLabelText("Nombre"), "Caro");
    await usuario.type(screen.getByLabelText("Apellido"), "Gómez");
    await usuario.type(screen.getByLabelText("Teléfono"), "11 4444-0000");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    await vi.waitFor(() => {
      const cuerpo = servidor.pedidos.find((p) => p.clave === "POST /api/alumnos")?.cuerpo;
      expect(cuerpo).toMatchObject({ profeId: null, fechaDeInicio: "", emergenciaNombre: "" });
      expect(cuerpo).not.toHaveProperty("numeroDeSocio");
    });
  });

  it("el email es opcional y va al final", async () => {
    conAlumnos(EDITA);
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(await screen.findByRole("button", { name: "Sumar alumno" }));
    const ficha = screen.getByRole("region", { name: "Sumar alumno" });
    const email = within(ficha).getByLabelText("Email");
    expect(within(ficha).getAllByRole("textbox").at(-1)).toBe(email);
    expect((email as HTMLInputElement).required).toBe(false);
  });
});

describe("el celular es opcional (0022)", () => {
  it("el alta se guarda sin teléfono y la edición tampoco lo exige", async () => {
    const servidor = conAlumnos(EDITA, {
      "POST /api/alumnos": { estado: 201, cuerpo: { id: CARO } },
      [`GET /api/alumnos/${CARO}`]: {
        estado: 200,
        cuerpo: { ...COMPLETA, id: CARO, nombre: "Caro", apellido: "Gómez", telefono: null },
      },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    await usuario.click(await screen.findByRole("button", { name: "Sumar alumno" }));
    expect(screen.getByLabelText<HTMLInputElement>("Teléfono").required).toBe(false);
    await usuario.type(screen.getByLabelText("Nombre"), "Caro");
    await usuario.type(screen.getByLabelText("Apellido"), "Gómez");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === "POST /api/alumnos")?.cuerpo).toMatchObject({
        telefono: "",
      });
    });

    await screen.findByRole("heading", { name: "Editar a Caro Gómez" });
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText<HTMLInputElement>("Teléfono").required).toBe(false);
  });
});

describe("editar la ficha completa", () => {
  it("abre con sus datos y manda los cambios del contacto y el profe", async () => {
    const servidor = conAlumnos(EDITA, {
      [`PUT /api/alumnos/${ANA}`]: { estado: 200, cuerpo: { version: 2 } },
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Editar" }));

    expect(valor("Número de socio")).toBe("283");
    expect(valor("Fecha de inicio")).toBe("2024-03-01");
    expect(valor("Contacto de emergencia")).toBe("Marta (madre)");
    expect(valor("Teléfono de emergencia")).toBe("11 4444-5555");
    await screen.findByRole("option", { name: "Pablo" });
    expect(valor("Profe")).toBe(LORE);

    await usuario.selectOptions(screen.getByLabelText("Profe"), "Sin profe");
    await usuario.clear(screen.getByLabelText("Teléfono de emergencia"));
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    await vi.waitFor(() => {
      expect(
        servidor.pedidos.find((p) => p.clave === `PUT /api/alumnos/${ANA}`)?.cuerpo,
      ).toMatchObject({ profeId: null, emergenciaTelefono: "", numeroDeSocio: 283, version: 1 });
    });
  });

  it("un profe que ya no está activo sigue apareciendo con su nombre", async () => {
    const otro = "db0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f6d";
    conAlumnos(EDITA, {
      "GET /api/alumnos?pagina=1": pagina([{ ...COMPLETA, profeId: otro, profeNombre: "Juli" }]),
    });
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Editar" }));
    await screen.findByRole("option", { name: "Lore" });
    expect(valor("Profe")).toBe(otro);
    expect(screen.getByRole("option", { name: "Juli" })).toBeDefined();
  });
});

describe("solo lectura", () => {
  it("muestra todo sin dejar cambiar y no pide la lista de profes", async () => {
    const servidor = conAlumnos(VE);
    const usuario = montarPanel();
    await abrirAlumnos(usuario);
    const ana = await screen.findByRole("row", { name: /Pérez, Ana/ });
    await usuario.click(within(ana).getByRole("button", { name: "Ver" }));

    expect(valor("Número de socio")).toBe("283");
    expect(valor("Fecha de inicio")).toBe("2024-03-01");
    expect(valor("Contacto de emergencia")).toBe("Marta (madre)");
    expect(valor("Teléfono de emergencia")).toBe("11 4444-5555");
    const profe = screen.getByLabelText<HTMLSelectElement>("Profe");
    expect(profe.selectedOptions[0]?.textContent).toBe("Lore");
    expect(profe.matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);
    expect(servidor.pedidos.some((p) => p.clave.startsWith("GET /api/alumnos/profes"))).toBe(false);
  });
});
