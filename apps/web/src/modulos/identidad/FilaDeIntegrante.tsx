// Una persona del equipo, con sus acciones. Generar una clave nueva y bloquear piden confirmación:
// cortan su acceso en el momento.
import type { PaginaDeEquipo } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { useBloquear, useNuevaClave, useReactivar } from "./consultas.ts";
import estilos from "./FilaDeIntegrante.module.css";

type Integrante = PaginaDeEquipo["elementos"][number];
type AlGenerarClave = (nombre: string, clave: string) => void;

interface Props {
  integrante: Integrante;
  nombresDeSedes: ReadonlyMap<string, string>;
  gestiona: boolean;
  alGenerarClave: AlGenerarClave;
}

type Confirmable = "clave" | "bloqueo";

const CONFIRMACIONES = {
  clave: {
    pregunta: (nombre: string) =>
      `¿Generar una clave temporal para ${nombre}? Su contraseña actual deja de servir y se cierra su sesión.`,
    si: "Sí, generar",
  },
  bloqueo: {
    pregunta: (nombre: string) =>
      `¿Bloquear a ${nombre}? Sale del sistema en el momento y no puede volver a entrar a este centro.`,
    si: "Sí, bloquear",
  },
};

function roles(integrante: Integrante, nombresDeSedes: ReadonlyMap<string, string>): string {
  return integrante.asignaciones
    .map((a) => `${a.rol} en ${nombresDeSedes.get(a.sedeId) ?? "otra sede"}`)
    .join(", ");
}

function useAcciones(integrante: Integrante, alGenerarClave: AlGenerarClave) {
  const nuevaClave = useNuevaClave();
  const bloquear = useBloquear();
  const reactivar = useReactivar();
  return {
    ocupado: nuevaClave.isPending || bloquear.isPending || reactivar.isPending,
    error: mensajeDe(nuevaClave.error ?? bloquear.error ?? reactivar.error),
    hacer: (accion: Confirmable) => {
      if (accion === "bloqueo") bloquear.mutate(integrante.id);
      else
        nuevaClave.mutate(integrante.id, {
          onSuccess: ({ claveTemporal }) => {
            alGenerarClave(integrante.nombre, claveTemporal);
          },
        });
    },
    reactivar: () => {
      reactivar.mutate(integrante.id);
    },
  };
}

function Confirmacion(props: {
  accion: Confirmable;
  nombre: string;
  alResponder: (si: boolean) => void;
}) {
  const { pregunta, si } = CONFIRMACIONES[props.accion];
  return (
    <div className={estilos.confirmar}>
      <p className={estilos.pregunta}>{pregunta(props.nombre)}</p>
      <Boton
        alHacerClic={() => {
          props.alResponder(true);
        }}
      >
        {si}
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

function Acciones({ integrante, alGenerarClave }: Pick<Props, "integrante" | "alGenerarClave">) {
  const [confirmando, setConfirmando] = useState<Confirmable | null>(null);
  const acciones = useAcciones(integrante, alGenerarClave);
  if (confirmando !== null) {
    const alResponder = (si: boolean) => {
      setConfirmando(null);
      if (si) acciones.hacer(confirmando);
    };
    return (
      <Confirmacion accion={confirmando} nombre={integrante.nombre} alResponder={alResponder} />
    );
  }
  const boton = (texto: string, alHacerClic: () => void) => (
    <Boton variante="secundario" deshabilitado={acciones.ocupado} alHacerClic={alHacerClic}>
      {texto}
    </Boton>
  );
  return (
    <div className={estilos.acciones}>
      {boton("Nueva clave temporal", () => {
        setConfirmando("clave");
      })}
      {integrante.activo
        ? boton("Bloquear", () => {
            setConfirmando("bloqueo");
          })
        : boton("Reactivar", acciones.reactivar)}
      {acciones.error !== undefined && <Aviso tono="error">{acciones.error}</Aviso>}
    </div>
  );
}

export function FilaDeIntegrante({ integrante, nombresDeSedes, gestiona, alGenerarClave }: Props) {
  return (
    <tr className={estilos.fila}>
      <th scope="row" className={estilos.nombre}>
        {integrante.nombre}
      </th>
      <td>{integrante.email}</td>
      <td>{roles(integrante, nombresDeSedes)}</td>
      <td>
        <span className={integrante.activo ? estilos.activo : estilos.bloqueado}>
          {integrante.activo ? "Activo" : "Bloqueado"}
        </span>
      </td>
      {gestiona && (
        <td>
          <Acciones integrante={integrante} alGenerarClave={alGenerarClave} />
        </td>
      )}
    </tr>
  );
}
