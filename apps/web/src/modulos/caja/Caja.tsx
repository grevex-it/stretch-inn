import { AnularPago } from "./AnularPago.tsx";
import { CobrarCuota } from "./CobrarCuota.tsx";
import { diaDeCaja } from "@app/contratos";
import { useState } from "react";
import { Campo } from "../../base/controles/Campo.tsx";
import { fechaLocal, ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import estilos from "./Caja.module.css";

const medios = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

export function Caja() {
  const permitido = usePermiso("caja.ver");
  const { data } = useSesion();
  const centro = data?.centroActivo;
  return (
    <section className={estilos.caja}>
      <h1 className={estilos.titulo}>Caja</h1>
      {permitido && centro ? (
        centro.sedeActiva === "todas" ? (
          <p>Elegí una sede en la barra para consultar su caja.</p>
        ) : (
          <Pagos
            key={centro.id + centro.sedeActiva}
            sede={centro.sedeActiva}
            zona={centro.zonaHoraria}
          />
        )
      ) : (
        <p>No tenés acceso a Caja.</p>
      )}
    </section>
  );
}

function Pagos({ sede, zona }: { sede: string; zona: string }) {
  const [dia, cambiarDia] = useState(() => fechaLocal(zona));
  const ruta = `/caja/pagos?sede=${sede}&dia=${dia}`;
  return (
    <>
      <CobrarCuota sede={sede} />
      <div className={estilos.dia}>
        <Campo etiqueta="Día de caja" tipo="date" valor={dia} alCambiar={cambiarDia} />
      </div>
      {dia && (
        <ListaRemota
          key={ruta}
          ruta={ruta}
          esquema={diaDeCaja}
          mostrar={(datos, alIrA) => (
            <>
              <h2 className={estilos.total}>Total cobrado: {pesos.format(datos.cobrado)}</h2>
              <Resultados
                datos={datos}
                alIrA={alIrA}
                fila={(pago) => (
                  <li key={pago.id} className={estilos.pago}>
                    <p className={estilos.dato}>
                      <strong className={estilos.monto}>{pesos.format(pago.monto)}</strong> ·{" "}
                      {medios[pago.medio]} · {horaLocal(pago.registradoEn, zona)}
                    </p>
                    {pago.anuladoEn ? (
                      <p className={estilos.dato}>
                        <span className={estilos.anulado}>Anulado</span> {pago.motivoAnulacion}
                      </p>
                    ) : (
                      <AnularPago id={pago.id} />
                    )}
                  </li>
                )}
              />
            </>
          )}
        />
      )}
    </>
  );
}

function horaLocal(instante: string, zona: string) {
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
  });
  return hora.format(new Date(instante));
}
