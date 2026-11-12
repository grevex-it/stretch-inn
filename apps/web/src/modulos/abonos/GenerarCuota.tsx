import { pedidoDeCuota, type Plan } from "@app/contratos";
import { useState } from "react";
import { BuscarAlumno } from "../../base/controles/BuscarAlumno.tsx";
import { FormularioDesplegable, FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { pesos } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";

export function GenerarCuota({ plan }: { plan: Plan }) {
  const asignar = usePermiso("abonos.asignar");
  const buscar = usePermiso("personas.ver");
  const { data } = useSesion();
  const sede = data?.centroActivo?.sedeActiva;
  if (!asignar || !buscar || !plan.activo || !sede) return null;
  if (sede === "todas") return <p>Elegí una sede en la barra para generar cuotas.</p>;
  return <CuotaDePlan key={sede} plan={plan} sede={sede} />;
}

function CuotaDePlan({ plan, sede }: { plan: Plan; sede: string }) {
  const [alumno, elegir] = useState<{ id: string; nombre: string }>();
  const precio = plan.preciosDeSede.find((item) => item.sedeId === sede)?.precio ?? plan.precio;
  return (
    <FormularioDesplegable titulo="Generar cuota">
      <BuscarAlumno alElegir={elegir} />
      {alumno && (
        <FormularioRemoto
          key={alumno.id}
          ruta="/abonos/cuotas"
          metodo="POST"
          etiqueta="Confirmar cuota"
          cuerpo={(datos) =>
            pedidoDeCuota.parse({
              alumnoId: alumno.id,
              planId: plan.id,
              sedeId: sede,
              desde: datos.get("desde") || undefined,
            })
          }
        >
          <p>
            {alumno.nombre} · {pesos.format(precio)}
          </p>
          <label>
            Empieza el (opcional, por defecto hoy; dura 4 semanas)
            <input type="date" name="desde" />
          </label>
        </FormularioRemoto>
      )}
    </FormularioDesplegable>
  );
}
