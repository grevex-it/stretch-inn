// Datos de los alumnos del centro (ver docs/decisiones/0011). Todo pasa por la API con TanStack
// Query.
import {
  alumno,
  alumnoCreado,
  alumnoEditado,
  paginaDeAlumnos,
  paginaDeProfes,
  saludDeAlumno,
  saludGuardada,
  type EdicionDeAlumno,
  type FichaDeAlumno,
  type SaludDeAlumno,
} from "@app/contratos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultar, enviar, enviarYLeer } from "../../base/api.ts";

const ALUMNOS = ["alumnos"] as const;

export interface Filtro {
  pagina: number;
  buscar: string;
  conBajas: boolean;
}

/** `?pagina=N`, y `&buscar=…` y `&bajas=si` solo si hacen falta. */
function rutaDeLaLista({ pagina, buscar, conBajas }: Filtro): string {
  const partes = [`pagina=${String(pagina)}`];
  if (buscar !== "") partes.push(`buscar=${encodeURIComponent(buscar)}`);
  if (conBajas) partes.push("bajas=si");
  return `/alumnos?${partes.join("&")}`;
}

export function useAlumnos(filtro: Filtro) {
  return useQuery({
    queryKey: [...ALUMNOS, filtro],
    queryFn: () => consultar(rutaDeLaLista(filtro), paginaDeAlumnos),
    placeholderData: (anterior) => anterior,
  });
}

/**
 * Después de cualquier cambio se vuelve a pedir la lista, también si falló: si otra persona
 * cambió la ficha en el medio, la lista trae la versión nueva para volver a editarla.
 */
function useCambioDeAlumnos<Datos, Resultado>(cambiar: (datos: Datos) => Promise<Resultado>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: cambiar,
    onSettled: () => cliente.invalidateQueries({ queryKey: ALUMNOS }),
  });
}

export const useCrearAlumno = () =>
  useCambioDeAlumnos((ficha: FichaDeAlumno) =>
    enviarYLeer("POST", "/alumnos", alumnoCreado, ficha),
  );

export const useEditarAlumno = () =>
  useCambioDeAlumnos(({ id, ...cambio }: EdicionDeAlumno & { id: string }) =>
    enviarYLeer("PUT", `/alumnos/${id}`, alumnoEditado, cambio),
  );

export const useDarDeBaja = () =>
  useCambioDeAlumnos((id: string) => enviar("PUT", `/alumnos/${id}/baja`));

export const useReactivar = () =>
  useCambioDeAlumnos((id: string) => enviar("DELETE", `/alumnos/${id}/baja`));

/** Un alumno por su id: la ficha que queda abierta después del alta. */
export function useAlumno(id: string) {
  return useQuery({
    queryKey: [...ALUMNOS, "uno", id],
    queryFn: () => consultar(`/alumnos/${id}`, alumno),
  });
}

/**
 * Los integrantes activos del equipo para elegir el profe. Recorre todas las páginas (la API las
 * da de a 50): la primera dice cuántas hay y las demás se piden juntas. Solo con personas.editar.
 */
async function todosLosProfes() {
  const pagina = (numero: number) =>
    consultar(`/alumnos/profes?pagina=${String(numero)}`, paginaDeProfes);
  const primera = await pagina(1);
  const cuantas = Math.ceil(primera.total / Math.max(primera.porPagina, 1));
  const resto = await Promise.all(
    Array.from({ length: Math.max(cuantas - 1, 0) }, (_, i) => pagina(i + 2)),
  );
  return [primera, ...resto].flatMap((p) => p.elementos);
}

export function useProfes(activo: boolean) {
  return useQuery({ queryKey: [...ALUMNOS, "profes"], queryFn: todosLosProfes, enabled: activo });
}

const salud = (id: string) => [...ALUMNOS, "salud", id];

/** Los antecedentes y patologías del alumno: solo con personas.ver-salud (0019). */
export function useSalud(id: string, activo: boolean) {
  return useQuery({
    queryKey: salud(id),
    queryFn: () => consultar(`/alumnos/${id}/salud`, saludDeAlumno),
    enabled: activo,
  });
}

/** Guarda con la versión que se vio (0013) y vuelve a pedirlos, también si falló. */
export function useGuardarSalud(id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: SaludDeAlumno) =>
      enviarYLeer("PUT", `/alumnos/${id}/salud`, saludGuardada, datos),
    onSettled: () => cliente.invalidateQueries({ queryKey: salud(id) }),
  });
}
