// Un alumno de la lista, con sus acciones. Dar de baja pide confirmación; reactivar, no. Sin
// personas.editar, solo «Ver»: la ficha se abre en solo lectura.
import type { Alumno } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { useDarDeBaja, useReactivar } from "./consultas.ts";
import estilos from "./FilaDeAlumno.module.css";

interface Props {
  alumno: Alumno;
  edita: boolean;
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

function Acciones({ alumno, alAbrir }: Omit<Props, "edita">) {
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
  const ocupado = baja.isPending || reactivar.isPending;
  return (
    <div className={estilos.acciones}>
      <Boton
        variante="secundario"
        alHacerClic={() => {
          alAbrir(alumno);
        }}
      >
        Editar
      </Boton>
      {alumno.activo ? (
        <Boton
          variante="secundario"
          deshabilitado={ocupado}
          alHacerClic={() => {
            setConfirmando(true);
          }}
        >
          Dar de baja
        </Boton>
      ) : (
        <Boton
          variante="secundario"
          deshabilitado={ocupado}
          alHacerClic={() => {
            reactivar.mutate(alumno.id);
          }}
        >
          Reactivar
        </Boton>
      )}
      {error !== undefined && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}

export function FilaDeAlumno({ alumno, edita, alAbrir }: Props) {
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
        {edita ? (
          <Acciones alumno={alumno} alAbrir={alAbrir} />
        ) : (
          <Boton
            variante="secundario"
            alHacerClic={() => {
              alAbrir(alumno);
            }}
          >
            Ver
          </Boton>
        )}
      </td>
    </tr>
  );
}
