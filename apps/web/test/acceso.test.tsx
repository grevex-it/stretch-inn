// Entrar, clave temporal y elegir centro (0017), con el panel montado entero.
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CENTRO, enCentro, montarPanel, NORTE, OTRO_CENTRO, SIN_SESION } from "./render.tsx";
import { servidorFalso } from "./servidor-falso.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const NORTE_SOLA = [{ id: NORTE, nombre: "Norte" }];

describe("entrar", () => {
  it("sin sesión muestra el login; al entrar, el panel del centro", async () => {
    const servidor = servidorFalso({ "GET /api/sesion": SIN_SESION });
    servidor.responder("POST /api/sesion", () => {
      servidor.responder("GET /api/sesion", enCentro(NORTE_SOLA));
      return { estado: 200, cuerpo: { debeCambiarClave: false, centros: [] } };
    });
    const usuario = montarPanel();

    await usuario.type(await screen.findByLabelText("Email"), "ana@ejemplo.com");
    await usuario.type(screen.getByLabelText("Contraseña"), "una clave larga");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Centro Uno")).toBeDefined();
    expect(servidor.pedidos.find((p) => p.clave === "POST /api/sesion")?.cuerpo).toEqual({
      email: "ana@ejemplo.com",
      clave: "una clave larga",
    });
  });

  it("con credenciales incorrectas muestra el mensaje de la API y sigue en el login", async () => {
    servidorFalso({
      "GET /api/sesion": SIN_SESION,
      "POST /api/sesion": {
        estado: 401,
        cuerpo: {
          error: { codigo: "credenciales-incorrectas", mensaje: "Email o contraseña incorrectos." },
        },
      },
    });
    const usuario = montarPanel();
    await usuario.type(await screen.findByLabelText("Email"), "ana@ejemplo.com");
    await usuario.type(screen.getByLabelText("Contraseña"), "mal");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Email o contraseña incorrectos.");
  });

  it("sin conexión con la API lo dice y deja reintentar", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    montarPanel();
    expect(await screen.findByText(/No pudimos conectarnos/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });
});

describe("clave temporal", () => {
  it("pide cambiarla antes de seguir y valida que las dos nuevas coincidan", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": {
        estado: 200,
        cuerpo: { debeCambiarClave: true, centros: [], centroActivo: null },
      },
      "PUT /api/sesion/clave": { estado: 204 },
    });
    const usuario = montarPanel();
    const repetida = () => screen.getByLabelText("Repetí la contraseña nueva");
    await usuario.type(await screen.findByLabelText("Contraseña actual"), "temporal");
    await usuario.type(screen.getByLabelText("Contraseña nueva"), "mi clave nueva");
    await usuario.type(repetida(), "otra cosa");
    await usuario.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Las contraseñas nuevas no coinciden.",
    );
    expect(servidor.pedidos.some((p) => p.clave === "PUT /api/sesion/clave")).toBe(false);

    await usuario.clear(repetida());
    await usuario.type(repetida(), "mi clave nueva");
    await usuario.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === "PUT /api/sesion/clave")?.cuerpo).toEqual({
        actual: "temporal",
        nueva: "mi clave nueva",
      });
    });
  });
});

describe("elegir centro", () => {
  it("con varios centros y ninguno elegido, los lista y elige uno", async () => {
    const servidor = servidorFalso({
      "GET /api/sesion": {
        estado: 200,
        cuerpo: {
          debeCambiarClave: false,
          centros: [
            { id: CENTRO, nombre: "Centro Uno" },
            { id: OTRO_CENTRO, nombre: "Centro Dos" },
          ],
          centroActivo: null,
        },
      },
      "PUT /api/sesion/centro": { estado: 204 },
    });
    const usuario = montarPanel();
    await usuario.click(await screen.findByRole("button", { name: "Centro Dos" }));
    await vi.waitFor(() => {
      expect(servidor.pedidos.find((p) => p.clave === "PUT /api/sesion/centro")?.cuerpo).toEqual({
        centroId: OTRO_CENTRO,
      });
    });
  });

  it("sin ningún centro explica qué hacer", async () => {
    servidorFalso({
      "GET /api/sesion": {
        estado: 200,
        cuerpo: { debeCambiarClave: false, centros: [], centroActivo: null },
      },
    });
    montarPanel();
    expect(await screen.findByText(/no tiene acceso a ningún centro/)).toBeDefined();
  });
});
