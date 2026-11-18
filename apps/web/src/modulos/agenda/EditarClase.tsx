import { edicionDeClase, fichaDeClase, type Clase } from "@app/contratos";
import { FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { useCamasDeSede } from "./CamasDeLaSede.tsx";

export function EditarClase({ clase, sede }: { clase?: Clase; sede: string }) {
  if (clase) return <Formulario clase={clase} sede={sede} />;
  return <NuevaClase sede={sede} />;
}

/** El cupo de una clase nueva arranca en las camas de la sede; sin camas, vacío. */
function NuevaClase({ sede }: { sede: string }) {
  const consulta = useCamasDeSede(sede);
  if (consulta.isPending) return <p role="status">Cargando…</p>;
  const camas = consulta.data?.camas ?? undefined;
  return <Formulario key={camas ?? "sin-camas"} sede={sede} camas={camas} />;
}

function Formulario({
  clase,
  sede,
  camas,
}: {
  clase?: Clase;
  sede: string;
  camas?: number | undefined;
}) {
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
      <Dia dia={clase?.dia} />
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
        <input
          name="cupo"
          type="number"
          min={1}
          max={camas}
          required
          defaultValue={clase?.cupo ?? camas}
        />
      </label>
    </FormularioRemoto>
  );
}

function Dia({ dia }: { dia: number | undefined }) {
  return (
    <label>
      Día
      <select name="dia" defaultValue={dia ?? 1}>
        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map(
          (nombre, indice) => (
            <option value={indice + 1} key={nombre}>
              {nombre}
            </option>
          ),
        )}
      </select>
    </label>
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
