// Datos de prueba de los roles a medida y los permisos de cada persona (0007): respuestas de la
// API como las define @app/contratos.
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { pagina, RECEPCION } from "./equipo-datos.ts";
import { NORTE } from "./render.tsx";

const DUENO = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
export const PROFESOR = "8b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f68";
export const PROPIO = "9b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f69";

export const CATALOGO = {
  estado: 200,
  cuerpo: {
    secciones: [
      {
        seccion: "Equipo",
        permisos: [
          { permiso: "usuarios.ver", descripcion: "Ver el equipo" },
          { permiso: "usuarios.gestionar", descripcion: "Gestionar el equipo" },
        ],
      },
      {
        seccion: "Caja",
        permisos: [
          { permiso: "caja.ver", descripcion: "Ver la caja" },
          { permiso: "caja.cobrar", descripcion: "Cobrar" },
          { permiso: "caja.anular", descripcion: "Anular pagos" },
        ],
      },
    ],
  },
};

export const LISTA_DE_ROLES = pagina([
  { id: DUENO, nombre: "Dueño", plantilla: "dueno" },
  { id: PROFESOR, nombre: "Profesor", plantilla: "profesor" },
  { id: PROPIO, nombre: "Profe sin bajas", plantilla: null },
  { id: RECEPCION, nombre: "Recepción", plantilla: null },
]);

export function ficha(id: string, nombre: string, plantilla: string | null, permisos: string[]) {
  return { estado: 200, cuerpo: { id, nombre, plantilla, permisos, version: 3 } };
}

export const GESTIONA_ROLES = ["usuarios.ver", "usuarios.gestionar", "roles.gestionar"];

/** Ana: Recepción en Norte (caja.ver y caja.anular), con caja.cobrar extra y caja.anular quitado. */
export function permisosDeAna(enOtrasSedes = false) {
  const fila = (permiso: string, roles: string[], ajuste: string | null, efectivo: boolean) => ({
    sedeId: NORTE,
    permiso,
    roles,
    ajuste,
    efectivo,
  });
  return {
    estado: 200,
    cuerpo: {
      asignaciones: [{ sedeId: NORTE, rolId: RECEPCION, rol: "Recepción" }],
      permisos: [
        fila("caja.ver", ["Recepción"], null, true),
        fila("caja.cobrar", [], "extra", true),
        fila("caja.anular", ["Recepción"], "quitado", false),
      ],
      enOtrasSedes,
    },
  };
}

/** Entra a Roles desde Equipo, como lo haría la persona. */
export async function abrirRoles(usuario: UserEvent) {
  await usuario.click(await screen.findByRole("link", { name: "Equipo" }));
  await usuario.click(await screen.findByRole("link", { name: "Roles" }));
  await screen.findByRole("heading", { level: 1, name: "Roles" });
}
