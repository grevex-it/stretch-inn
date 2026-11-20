// Las cuotas de un alumno, la más nueva primero (con abonos.ver). Abonos no conoce a caja: quien
// la usa decide qué acción ofrecer en cada cuota pagada, por ejemplo anular su pago (0019). Sin
// totales: lo que suma la caja queda para caja.ver.
import { paginaDeCuotas, type Cuota } from "@app/contratos";
import { useId, type ReactNode } from "react";
import { ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import { textoDelCiclo } from "./ciclo.ts";
import estilos from "./CuotasDelAlumno.module.css";

/** Una cuota pagada: siempre trae el pago que la saldó. */
type CuotaPagada = Cuota & { pagadaEn: string; pagoId: string };

interface Props {
  alumnoId: string;
  /** Lo que se ofrece en cada cuota pagada. */
  accion?: (cuota: CuotaPagada) => ReactNode;
}

export function CuotasDelAlumno({ alumnoId, accion }: Props) {
  const permitido = usePermiso("abonos.ver");
  const titulo = useId();
  const zona = useSesion().data?.centroActivo?.zonaHoraria;
  if (!permitido || zona === undefined) return null;
  return (
    <section className={estilos.cuotas} aria-labelledby={titulo}>
      <h3 id={titulo} className={estilos.titulo}>
        Cuotas
      </h3>
      <ListaRemota
        ruta={`/alumnos/${alumnoId}/cuotas`}
        esquema={paginaDeCuotas}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(cuota) => (
              <li key={cuota.id}>
                {textoDelCiclo(cuota)} · {pesos.format(cuota.monto)} · {estado(cuota, zona)}
                {esPagada(cuota) && accion?.(cuota)}
              </li>
            )}
          />
        )}
      />
    </section>
  );
}

function esPagada(cuota: Cuota): cuota is CuotaPagada {
  return cuota.pagadaEn !== null && cuota.pagoId !== null;
}

/** «Pagada el 01/11/2026», en la zona del centro (regla 3), o «Impaga». */
function estado(cuota: Cuota, zona: string): string {
  if (cuota.pagadaEn === null) return "Impaga";
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `Pagada el ${dia.format(new Date(cuota.pagadaEn))}`;
}
