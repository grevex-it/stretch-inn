import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { z } from "zod";
import { consultar } from "../api.ts";
import { useSesion } from "../sesion.ts";
import { Aviso, mensajeDe } from "./Aviso.tsx";
import { Paginacion } from "./Paginacion.tsx";
import estilos from "./ListaRemota.module.css";

export function ListaRemota<T>({
  ruta,
  esquema,
  mostrar,
}: {
  ruta: string;
  esquema: z.ZodType<T>;
  mostrar: (datos: T, alIrA: (pagina: number) => void) => ReactNode;
}) {
  const [pagina, alIrA] = useState(1);
  const { data: sesion } = useSesion();
  const centro = sesion?.centroActivo;
  const consulta = useQuery({
    queryKey: [ruta, centro?.id, centro?.sedeActiva, pagina],
    queryFn: () =>
      consultar(ruta + (ruta.includes("?") ? "&" : "?") + "pagina=" + String(pagina), esquema),
  });
  if (consulta.isPending) return <p role="status">Cargando…</p>;
  if (consulta.isError) return <Aviso tono="error">{mensajeDe(consulta.error)}</Aviso>;
  return mostrar(consulta.data, alIrA);
}

export function Resultados<T>({
  datos,
  alIrA,
  fila,
}: {
  datos: { elementos: T[]; pagina: number; porPagina: number; total: number };
  alIrA: (pagina: number) => void;
  fila: (item: T) => ReactNode;
}) {
  if (datos.elementos.length === 0 && datos.total === 0) return <p>No hay resultados.</p>;
  return (
    <>
      <ul className={estilos.lista}>{datos.elementos.map(fila)}</ul>
      <Paginacion pagina={datos} alIrA={alIrA} />
    </>
  );
}

export function fechaLocal(zona: string) {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  return ["year", "month", "day"]
    .map((tipo) => partes.find((parte) => parte.type === tipo)?.value)
    .join("-");
}

export const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
