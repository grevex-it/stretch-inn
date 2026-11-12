import { edicionDePlan, fichaDePlan, type Plan } from "@app/contratos";
import { FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";

export function EditarPlan({ plan }: { plan?: Plan }) {
  return (
    <FormularioRemoto
      ruta={plan ? `/abonos/planes/${plan.id}` : "/abonos/planes"}
      metodo={plan ? "PUT" : "POST"}
      cuerpo={(datos) => {
        const campos = {
          nombre: datos.get("nombre"),
          clasesPorSemana: Number(datos.get("clases")),
          precio: Number(datos.get("precio")),
        };
        return plan
          ? edicionDePlan.parse({ ...campos, version: plan.version })
          : fichaDePlan.parse(campos);
      }}
    >
      <label>
        Nombre del plan
        <input name="nombre" required maxLength={100} defaultValue={plan?.nombre} />
      </label>
      <label>
        Clases por semana
        <input name="clases" type="number" min={1} required defaultValue={plan?.clasesPorSemana} />
      </label>
      <label>
        Precio general en pesos
        <input name="precio" type="number" min={1} required defaultValue={plan?.precio} />
      </label>
    </FormularioRemoto>
  );
}
