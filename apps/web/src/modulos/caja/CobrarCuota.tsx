import { BuscarAlumno } from "../../base/controles/BuscarAlumno.tsx";
import { paginaDeCuotas, pedidoDeCobro, type Cuota } from "@app/contratos";
import { useRef, useState } from "react";
import { FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso } from "../../base/sesion.ts";
import { textoDelCiclo } from "../abonos/ciclo.ts";

export function CobrarCuota({ sede }: { sede: string }) {
  const permitido = usePuedeCobrar();

  const [alumno, elegir] = useState<{ id: string; nombre: string }>();
  if (!permitido) return null;
  return (
    <details>
      <summary>Cobrar cuota</summary>
      <BuscarAlumno alElegir={elegir} />
      {alumno && <Cuotas key={alumno.id} alumno={alumno} sede={sede} />}
    </details>
  );
}

function Cuotas({ alumno, sede }: { alumno: { id: string; nombre: string }; sede: string }) {
  return (
    <>
      <h3>Cuotas de {alumno.nombre}</h3>
      <ListaRemota
        ruta={`/alumnos/${alumno.id}/cuotas`}
        esquema={paginaDeCuotas}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(cuota) => (
              <li key={cuota.id}>
                {textoDelCiclo(cuota)} · {pesos.format(cuota.monto)} ·{" "}
                {cuota.pagadaEn ? "Pagada" : "Impaga"}
                {!cuota.pagadaEn && cuota.sedeId === sede && <Cobro cuota={cuota} />}
              </li>
            )}
          />
        )}
      />
    </>
  );
}

function Cobro({ cuota }: { cuota: Cuota }) {
  const claves = useRef(new Map<string, string>());
  return (
    <FormularioRemoto
      ruta="/caja/cobros"
      metodo="POST"
      etiqueta="Registrar cobro"
      cuerpo={(datos) => {
        const valor = datos.get("medio");
        const medio = typeof valor === "string" ? valor : "";
        const claveIdempotencia = claves.current.get(medio) ?? crypto.randomUUID();
        claves.current.set(medio, claveIdempotencia);
        return pedidoDeCobro.parse({ cuotaId: cuota.id, medio, claveIdempotencia });
      }}
    >
      <label>
        Medio de pago
        <select name="medio" required defaultValue="">
          <option value="" disabled>
            Elegí un medio
          </option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </label>
    </FormularioRemoto>
  );
}

function usePuedeCobrar() {
  const caja = usePermiso("caja.cobrar");
  const alumnos = usePermiso("personas.ver");
  const abonos = usePermiso("abonos.ver");
  return caja && alumnos && abonos;
}
