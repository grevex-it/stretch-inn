import { diaDeCaja } from "@app/contratos";
import { useState } from "react";
import { fechaLocal, ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";

const medios = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "Mercado Pago",
};

export function Caja() {
  const permitido = usePermiso("caja.ver");
  const { data } = useSesion();
  const centro = data?.centroActivo;
  return (
    <section>
      <h1>Caja</h1>
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
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
  });
  const ruta = `/caja/pagos?sede=${sede}&dia=${dia}`;
  return (
    <>
      <label>
        Día de caja{" "}
        <input
          type="date"
          value={dia}
          onChange={(evento) => {
            cambiarDia(evento.target.value);
          }}
        />
      </label>
      {dia && (
        <ListaRemota
          key={ruta}
          ruta={ruta}
          esquema={diaDeCaja}
          mostrar={(datos, alIrA) => (
            <>
              <h2>Total cobrado: {pesos.format(datos.cobrado)}</h2>
              <Resultados
                datos={datos}
                alIrA={alIrA}
                fila={(pago) => (
                  <li key={pago.id}>
                    <strong>{pesos.format(pago.monto)}</strong> · {medios[pago.medio]} ·{" "}
                    {hora.format(new Date(pago.registradoEn))}
                    {pago.anuladoEn && <p>Anulado · {pago.motivoAnulacion}</p>}
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
