import { pedidoDeAnulacion } from "@app/contratos";
import { FormularioDesplegable, FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { usePermiso } from "../../base/sesion.ts";

export function AnularPago({ id }: { id: string }) {
  const permitido = usePermiso("caja.anular");
  if (!permitido) return null;
  return (
    <FormularioDesplegable titulo="Anular pago">
      <FormularioRemoto
        ruta={`/caja/pagos/${id}/anulacion`}
        metodo="POST"
        etiqueta="Confirmar anulación"
        cuerpo={(datos) => pedidoDeAnulacion.parse({ motivo: datos.get("motivo") })}
      >
        <label>
          Motivo de la anulación
          <input name="motivo" required maxLength={500} />
        </label>
      </FormularioRemoto>
    </FormularioDesplegable>
  );
}
