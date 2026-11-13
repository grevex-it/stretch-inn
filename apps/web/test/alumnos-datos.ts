// Datos de prueba de la pantalla Alumnos: respuestas de la API como las define @app/contratos.
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { NORTE } from "./render.tsx";

export const ANA = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
export const BEA = "8b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f68";

export const UNA_SEDE = [{ id: NORTE, nombre: "Norte" }];
export const VE = ["personas.ver"];
export const EDITA = ["personas.ver", "personas.editar"];

export function alumno(id: string, nombre: string, apellido: string, activo = true) {
  return {
    id,
    nombre,
    apellido,
    telefono: "11 5555-1234",
    documento: "30123456",
    email: null,
    fechaNacimiento: null,
    notas: "",
    numeroDeSocio: 54,
    fechaDeInicio: null,
    profeId: null,
    activo,
    bajaEn: activo ? null : "2026-11-01T00:00:00.000Z",
    pendienteDeCompletar: false,
    version: 1,
  };
}

export function pagina(elementos: unknown[], total = elementos.length, numero = 1) {
  return { estado: 200, cuerpo: { pagina: numero, porPagina: 50, total, elementos } };
}

export const LISTA = pagina([alumno(ANA, "Ana", "Pérez"), alumno(BEA, "Bea", "Zapata")]);

/** Entra a Alumnos desde la navegación, como lo haría la persona. */
export async function abrirAlumnos(usuario: UserEvent) {
  await usuario.click(await screen.findByRole("link", { name: "Alumnos" }));
  await screen.findByRole("heading", { level: 1, name: "Alumnos" });
}
