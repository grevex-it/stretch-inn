// Las camas de la sede (pedido del 12/11): el cupo de todos sus horarios. Se cambian con
// agenda.gestionar y son obligatorias: desde el panel una sede no queda sin tope. Si bajarlas
// deja afuera a los fijos de alguna clase, se listan todas las que lo impiden.
import { camasDeSede, type Clase } from "@app/contratos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultar, enviar, ErrorDeApi } from "../../base/api.ts";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { FormularioDesplegable } from "../../base/controles/FormularioRemoto.tsx";
import { usePermiso } from "../../base/sesion.ts";
import { clasesQueImpiden } from "./clases-de-la-sede.ts";

const camasObligatorias = camasDeSede.extend({ camas: camasDeSede.shape.camas.unwrap() });

const rutaDeCamas = (sede: string) => `/agenda/sedes/${sede}/camas`;

/** Las camas de la sede: null si todavía no tiene. */
export function useCamasDeSede(sede: string) {
  const ruta = rutaDeCamas(sede);
  return useQuery({ queryKey: [ruta], queryFn: () => consultar(ruta, camasDeSede) });
}

export function CamasDeLaSede({ sede }: { sede: string }) {
  const gestionar = usePermiso("agenda.gestionar");
  if (!gestionar) return null;
  return (
    <FormularioDesplegable titulo="Camas de la sede">
      <Camas sede={sede} />
    </FormularioDesplegable>
  );
}

function Camas({ sede }: { sede: string }) {
  const consulta = useCamasDeSede(sede);
  if (consulta.isPending) return <p role="status">Cargando…</p>;
  if (consulta.isError) return <Aviso tono="error">{mensajeDe(consulta.error)}</Aviso>;
  return <Formulario sede={sede} camas={consulta.data.camas} />;
}

/** El rechazo por fijos, con todas las clases que tienen más fijos que las camas pedidas. */
class CamasQueDejanAfuera extends ErrorDeApi {
  readonly camas: number;
  readonly clases: readonly Clase[];

  constructor(error: ErrorDeApi, camas: number, clases: readonly Clase[]) {
    super(error.estado, error.codigo, error.message);
    this.camas = camas;
    this.clases = clases;
  }
}

async function guardar(sede: string, datos: FormData): Promise<void> {
  const pedido = camasObligatorias.safeParse({ camas: Number(datos.get("camas") || Number.NaN) });
  if (!pedido.success) {
    const mensaje = pedido.error.issues[0]?.message ?? "Revisá las camas.";
    throw new ErrorDeApi(400, "pedido-invalido", mensaje);
  }
  const { camas } = pedido.data;
  try {
    await enviar("PUT", rutaDeCamas(sede), { camas });
  } catch (error) {
    if (!(error instanceof ErrorDeApi) || error.codigo !== "camas-menos-que-inscriptos")
      throw error;
    const clases = await clasesQueImpiden(sede, camas).catch(() => undefined);
    throw clases === undefined ? error : new CamasQueDejanAfuera(error, camas, clases);
  }
}

function Formulario({ sede, camas }: { sede: string; camas: number | null }) {
  const cliente = useQueryClient();
  const cambio = useMutation({
    mutationFn: (datos: FormData) => guardar(sede, datos),
    onSuccess: async () => {
      await cliente.invalidateQueries();
    },
  });
  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!cambio.isPending) cambio.mutate(new FormData(evento.currentTarget));
      }}
    >
      {camas === null && (
        <Aviso tono="alerta">
          Esta sede todavía no tiene camas cargadas. Cargalas: son el cupo de todos sus horarios.
        </Aviso>
      )}
      <fieldset disabled={cambio.isPending}>
        <label>
          Camas de la sede (el cupo de todos sus horarios)
          <input
            name="camas"
            type="number"
            min={1}
            max={500}
            step={1}
            required
            defaultValue={camas ?? undefined}
          />
        </label>
      </fieldset>
      {cambio.isError && <Aviso tono="error">{mensajeDe(cambio.error)}</Aviso>}
      {cambio.error instanceof CamasQueDejanAfuera && <QueLoImpiden error={cambio.error} />}
      {cambio.isSuccess && <Aviso tono="ok">Cambios guardados.</Aviso>}
      <Boton tipo="submit" deshabilitado={cambio.isPending}>
        Guardar camas
      </Boton>
    </form>
  );
}

function QueLoImpiden({ error }: { error: CamasQueDejanAfuera }) {
  return (
    <ul aria-label={`Clases con más fijos que ${String(error.camas)} camas`}>
      {error.clases.map((clase) => (
        <li key={clase.id}>
          {clase.nombre} · {clase.inscriptos} fijos
        </li>
      ))}
    </ul>
  );
}
