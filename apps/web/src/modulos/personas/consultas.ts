// Datos de los alumnos del centro (ver docs/decisiones/0011). Todo pasa por la API con TanStack
// Query.
import {
  alumnoCreado,
  alumnoEditado,
  paginaDeAlumnos,
  type EdicionDeAlumno,
  type FichaDeAlumno,
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

/** Después de cualquier cambio se vuelve a pedir la lista. */
function useCambioDeAlumnos<Datos, Resultado>(cambiar: (datos: Datos) => Promise<Resultado>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: cambiar,
    onSuccess: () => cliente.invalidateQueries({ queryKey: ALUMNOS }),
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
