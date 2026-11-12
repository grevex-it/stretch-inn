import { edicionDeClase, fichaDeClase, type Clase } from "@app/contratos";
import { FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";

export function EditarClase({ clase, sede }: { clase?: Clase; sede: string }) {
  return (
    <FormularioRemoto
      ruta={clase ? `/agenda/clases/${clase.id}` : "/agenda/clases"}
      metodo={clase ? "PUT" : "POST"}
      cuerpo={(datos) => datosDeClase(datos, sede, clase)}
    >
      <label>
        Nombre de la clase
        <input name="nombre" required maxLength={100} defaultValue={clase?.nombre} />
      </label>
      <label>
        Día
        <select name="dia" defaultValue={clase?.dia ?? 1}>
          {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map(
            (dia, indice) => (
              <option value={indice + 1} key={dia}>
                {dia}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        Hora
        <input name="hora" type="time" required defaultValue={clase?.hora} />
      </label>
      <label>
        Duración en minutos
        <input
          name="duracion"
          type="number"
          min={1}
          required
          defaultValue={clase?.duracionMinutos}
        />
      </label>
      <label>
        Cupo
        <input name="cupo" type="number" min={1} required defaultValue={clase?.cupo} />
      </label>
    </FormularioRemoto>
  );
}

function datosDeClase(datos: FormData, sede: string, clase?: Clase) {
  const campos = {
    nombre: datos.get("nombre"),
    dia: Number(datos.get("dia")),
    hora: datos.get("hora"),
    duracionMinutos: Number(datos.get("duracion")),
    cupo: Number(datos.get("cupo")),
  };
  return clase
    ? edicionDeClase.parse({ ...campos, version: clase.version })
    : fichaDeClase.parse({ ...campos, sedeId: sede });
}
