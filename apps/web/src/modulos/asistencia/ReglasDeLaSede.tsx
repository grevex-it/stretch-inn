// Las reglas de recuperación de la sede (0020): anticipación para anotarse, máximo por abono y si
// se puede recuperar sin abono vigente. Se cambian con asistencia.configurar.
import { reglasDeRecuperacion, type ReglasDeRecuperacion } from "@app/contratos";
import { useQuery } from "@tanstack/react-query";
import { consultar } from "../../base/api.ts";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { FormularioDesplegable, FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { usePermiso } from "../../base/sesion.ts";

export function ReglasDeLaSede({ sede }: { sede: string }) {
  const configurar = usePermiso("asistencia.configurar");
  if (!configurar) return null;
  return (
    <FormularioDesplegable titulo="Reglas de recuperación de la sede">
      <Reglas sede={sede} />
    </FormularioDesplegable>
  );
}

function Reglas({ sede }: { sede: string }) {
  const ruta = `/asistencia/sedes/${sede}/reglas`;
  const consulta = useQuery({
    queryKey: [ruta],
    queryFn: () => consultar(ruta, reglasDeRecuperacion),
  });
  if (consulta.isPending) return <p role="status">Cargando…</p>;
  if (consulta.isError) return <Aviso tono="error">{mensajeDe(consulta.error)}</Aviso>;
  return <Formulario ruta={ruta} reglas={consulta.data} />;
}

function Formulario({ ruta, reglas }: { ruta: string; reglas: ReglasDeRecuperacion }) {
  return (
    <FormularioRemoto
      ruta={ruta}
      metodo="PUT"
      etiqueta="Guardar reglas"
      cuerpo={(datos) =>
        reglasDeRecuperacion.parse({
          anticipacionMinutos: Number(datos.get("anticipacion")),
          maximoPorAbono: Number(datos.get("maximo")),
          sinAbono: datos.get("sinAbono") === "si",
        })
      }
    >
      <label>
        Anticipación para anotarse a recuperar (minutos antes de la clase)
        <input
          name="anticipacion"
          type="number"
          min={0}
          max={10_080}
          required
          defaultValue={reglas.anticipacionMinutos}
        />
      </label>
      <label>
        Máximo de recuperaciones por abono
        <input
          name="maximo"
          type="number"
          min={0}
          max={100}
          required
          defaultValue={reglas.maximoPorAbono}
        />
      </label>
      <label>
        <input name="sinAbono" type="checkbox" value="si" defaultChecked={reglas.sinAbono} />
        Puede recuperar sin abono vigente
      </label>
    </FormularioRemoto>
  );
}
