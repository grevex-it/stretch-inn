import { pedidoDeAsistencia } from "@app/contratos";
import { FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { usePermiso } from "../../base/sesion.ts";

export function MarcarAsistencia({
  fecha,
  alumnoId,
  estado,
}: {
  fecha: string;
  alumnoId: string;
  estado: "presente" | "ausente" | null;
}) {
  const permitido = usePermiso("asistencia.tomar");
  if (!permitido) return null;
  return (
    <FormularioRemoto
      ruta={`/asistencia/fechas/${fecha}`}
      metodo="PUT"
      etiqueta="Guardar asistencia"
      cuerpo={(datos) =>
        pedidoDeAsistencia.parse({ marcas: [{ alumnoId, estado: datos.get("estado") }] })
      }
    >
      <label>
        Asistencia
        <select name="estado" defaultValue={estado ?? ""} required>
          <option value="" disabled>
            Elegí un estado
          </option>
          <option value="presente">Presente</option>
          <option value="ausente">Ausente</option>
        </select>
      </label>
    </FormularioRemoto>
  );
}
