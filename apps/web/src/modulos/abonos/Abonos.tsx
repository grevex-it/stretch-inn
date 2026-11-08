import type { Plan } from "@app/contratos";
import { FormularioDesplegable } from "../../base/controles/FormularioRemoto.tsx";
import { EditarPlan } from "./EditarPlan.tsx";
import { paginaDePlanes } from "@app/contratos";
import { ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";

export function Abonos() {
  const gestionar = usePermiso("abonos.gestionar");
  const permitido = usePermiso("abonos.ver");
  const { data } = useSesion();
  const centro = data?.centroActivo;
  return (
    <section>
      <h1>Abonos</h1>
      {gestionar && (
        <FormularioDesplegable titulo="Nuevo plan">
          <EditarPlan />
        </FormularioDesplegable>
      )}
      {permitido ? (
        <ListaRemota
          key={centro?.id}
          ruta="/abonos/planes"
          esquema={paginaDePlanes}
          mostrar={(datos, alIrA) => (
            <Resultados
              datos={datos}
              alIrA={alIrA}
              fila={(plan) => (
                <li key={plan.id}>
                  <strong>{plan.nombre}</strong>
                  {gestionar && <Edicion plan={plan} />}
                  <p>
                    {plan.clasesPorSemana} clases por semana · {pesos.format(plan.precio)} de precio
                    general · {plan.activo ? "Activo" : "De baja"}
                  </p>
                  {plan.preciosDeSede.map((precio) => (
                    <p key={precio.sedeId}>
                      {centro?.sedes.find((sede) => sede.id === precio.sedeId)?.nombre ??
                        "Otra sede"}{" "}
                      · {pesos.format(precio.precio)}
                    </p>
                  ))}
                </li>
              )}
            />
          )}
        />
      ) : (
        <p>No tenés acceso a Abonos.</p>
      )}
    </section>
  );
}

function Edicion({ plan }: { plan: Plan }) {
  return (
    <FormularioDesplegable titulo="Editar plan">
      <EditarPlan plan={plan} />
    </FormularioDesplegable>
  );
}
