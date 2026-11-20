import { GenerarCuota } from "./GenerarCuota.tsx";
import type { EstadoDeSesion, Plan } from "@app/contratos";
import { FormularioDesplegable } from "../../base/controles/FormularioRemoto.tsx";
import { EditarPlan } from "./EditarPlan.tsx";
import { paginaDePlanes } from "@app/contratos";
import { ListaRemota, pesos, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import estilos from "./Abonos.module.css";

export function Abonos() {
  const gestionar = usePermiso("abonos.gestionar");
  const permitido = usePermiso("abonos.ver");
  const { data } = useSesion();
  const centro = data?.centroActivo;
  return (
    <section className={estilos.abonos}>
      <h1 className={estilos.titulo}>Abonos</h1>
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
                <FichaDePlan
                  key={plan.id}
                  plan={plan}
                  gestionar={gestionar}
                  sedes={centro?.sedes ?? []}
                />
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

type Sedes = NonNullable<NonNullable<EstadoDeSesion>["centroActivo"]>["sedes"];

/** Un plan: el nombre, debajo el dato (clases, precio, estado y precios por sede) y, al final,
 * «Editar plan» y «Generar cuota» en la misma fila. */
function FichaDePlan({ plan, gestionar, sedes }: { plan: Plan; gestionar: boolean; sedes: Sedes }) {
  return (
    <li className={estilos.plan}>
      <strong className={estilos.nombre}>{plan.nombre}</strong>
      <p className={estilos.detalle}>
        {plan.clases} {plan.clases === 1 ? "clase" : "clases"} · {pesos.format(plan.precio)} de
        precio general · {plan.activo ? "Activo" : "De baja"}
      </p>
      {plan.preciosDeSede.map((precio) => (
        <p key={precio.sedeId} className={estilos.detalle}>
          {sedes.find((sede) => sede.id === precio.sedeId)?.nombre ?? "Otra sede"} ·{" "}
          {pesos.format(precio.precio)}
        </p>
      ))}
      <div className={estilos.acciones}>
        {gestionar && <Edicion plan={plan} />}
        <GenerarCuota plan={plan} />
      </div>
    </li>
  );
}

function Edicion({ plan }: { plan: Plan }) {
  return (
    <FormularioDesplegable titulo="Editar plan">
      <EditarPlan plan={plan} />
    </FormularioDesplegable>
  );
}
