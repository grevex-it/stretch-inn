// Datos de prueba de la pantalla Equipo: respuestas de la API como las define @app/contratos.
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { NORTE, SUR } from "./render.tsx";

export const ANA = "4b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f64";
export const BEA = "5b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f65";
export const RECEPCION = "6b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f66";

export const DOS_SEDES = [
  { id: NORTE, nombre: "Norte" },
  { id: SUR, nombre: "Sur" },
];

export const VE = ["usuarios.ver"];
export const GESTIONA = ["usuarios.ver", "usuarios.gestionar"];

export function integrante(id: string, nombre: string, activo = true) {
  return {
    id,
    nombre,
    email: `${nombre.toLowerCase()}@ejemplo.com`,
    activo,
    asignaciones: [{ sedeId: NORTE, rolId: RECEPCION, rol: "Recepción" }],
  };
}

export function pagina(elementos: unknown[], total = elementos.length, numero = 1) {
  return { estado: 200, cuerpo: { pagina: numero, porPagina: 50, total, elementos } };
}

export const ROLES = pagina([{ id: RECEPCION, nombre: "Recepción" }]);

/** Entra a Equipo desde la navegación, como lo haría la persona. */
export async function abrirEquipo(usuario: UserEvent) {
  await usuario.click(await screen.findByRole("link", { name: "Equipo" }));
  await screen.findByRole("heading", { level: 1, name: "Equipo" });
}
