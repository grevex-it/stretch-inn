// Monta el panel entero, como en el navegador, con un fetch falso.
import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { Aplicacion } from "../src/base/Aplicacion.tsx";
import { crearClienteDeConsultas } from "../src/base/consultas.ts";

// Sin los globals de Vitest, Testing Library no desmonta solo entre tests.
afterEach(() => {
  cleanup();
});

export function montarPanel() {
  const usuario = userEvent.setup();
  render(
    <Aplicacion
      clienteDeConsultas={crearClienteDeConsultas({ reintentar: false })}
      historial={createMemoryHistory()}
    />,
  );
  return usuario;
}

export const CENTRO = "0b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f60";
export const OTRO_CENTRO = "1b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f61";
export const NORTE = "2b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f62";
export const SUR = "3b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f63";

interface Cambios {
  sedeActiva?: string;
  sedeCambiada?: boolean;
  centros?: number;
  permisos?: string[];
}

/** Estado de una sesión trabajando en el centro, con las sedes indicadas. */
export function enCentro(sedes: { id: string; nombre: string }[], cambios: Cambios = {}) {
  const centros = [
    { id: CENTRO, nombre: "Centro Uno" },
    { id: OTRO_CENTRO, nombre: "Centro Dos" },
  ].slice(0, cambios.centros ?? 1);
  const porDefecto = sedes.length > 1 ? "todas" : (sedes[0]?.id ?? "");
  return {
    estado: 200,
    cuerpo: {
      debeCambiarClave: false,
      centros,
      centroActivo: {
        id: CENTRO,
        nombre: "Centro Uno",
        sedeActiva: cambios.sedeActiva ?? porDefecto,
        sedes,
        sedeCambiada: cambios.sedeCambiada ?? false,
        permisos: cambios.permisos ?? [],
      },
    },
  };
}

export const SIN_SESION = {
  estado: 401,
  cuerpo: { error: { codigo: "sin-sesion", mensaje: "Tu sesión terminó. Volvé a entrar." } },
};
