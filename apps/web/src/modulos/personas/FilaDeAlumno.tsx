// Un alumno de la lista, con sus acciones. Con personas.editar, «Editar»; sin él, «Ver» y la ficha
// en solo lectura. Dar de baja y reactivar van con personas.dar-de-baja: la baja pide
// confirmación; reactivar, no.
import type { Alumno } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { useDarDeBaja, useReactivar } from "./consultas.ts";
import estilos from "./FilaDeAlumno.module.css";

interface Props {
  alumno: Alumno;
  edita: boolean;
  /** Con personas.dar-de-baja: «Dar de baja» o «Reactivar». */
  daDeBaja: boolean;
  /** Abre la ficha: para editarla o, sin personas.editar, para verla. */
  alAbrir: (alumno: Alumno) => void;
}

function ConfirmarBaja(props: { alumno: Alumno; alResponder: (si: boolean) => void }) {
  return (
    <div className={estilos.acciones}>
      <p className={estilos.pregunta}>
        ¿Dar de baja a {props.alumno.nombre} {props.alumno.apellido}? Deja de aparecer en la lista;
        podés reactivarlo cuando quieras.
      </p>
      <Boton
        alHacerClic={() => {
          props.alResponder(true);
        }}
      >
        Sí, dar de baja
      </Boton>
      <Boton
        variante="secundario"
        alHacerClic={() => {
          props.alResponder(false);
        }}
      >
        Cancelar
      </Boton>
    </div>
  );
}

function BotonDeBaja(props: {
  alumno: Alumno;
  ocupado: boolean;
  alPedir: () => void;
  alReactivar: () => void;
}) {
  return props.alumno.activo ? (
    <Boton variante="secundario" deshabilitado={props.ocupado} alHacerClic={props.alPedir}>
      Dar de baja
    </Boton>
  ) : (
    <Boton variante="secundario" deshabilitado={props.ocupado} alHacerClic={props.alReactivar}>
      Reactivar
    </Boton>
  );
}

function Acciones({ alumno, edita, daDeBaja, alAbrir }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const baja = useDarDeBaja();
  const reactivar = useReactivar();
  const error = mensajeDe(baja.error ?? reactivar.error);
  if (confirmando) {
    const alResponder = (si: boolean) => {
      setConfirmando(false);
      if (si) baja.mutate(alumno.id);
    };
    return <ConfirmarBaja alumno={alumno} alResponder={alResponder} />;
  }
  return (
    <div className={estilos.acciones}>
      <Boton
        variante="secundario"
        alHacerClic={() => {
          alAbrir(alumno);
        }}
      >
        {edita ? "Editar" : "Ver"}
      </Boton>
      {daDeBaja && (
        <BotonDeBaja
          alumno={alumno}
          ocupado={baja.isPending || reactivar.isPending}
          alPedir={() => {
            setConfirmando(true);
          }}
          alReactivar={() => {
            reactivar.mutate(alumno.id);
          }}
        />
      )}
      {error !== undefined && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}

export function FilaDeAlumno(props: Props) {
  const { alumno } = props;
  return (
    <tr className={estilos.fila}>
      <th scope="row" className={estilos.nombre}>
        {alumno.apellido}, {alumno.nombre}
      </th>
      <td>{alumno.telefono}</td>
      <td>{alumno.documento ?? "—"}</td>
      <td>
        <span className={alumno.activo ? estilos.activo : estilos.baja}>
          {alumno.activo ? "Activo" : "De baja"}
        </span>
      </td>
      <td>
        <Acciones {...props} />
      </td>
    </tr>
  );
}
