// Los datos de la ficha del alumno, en el orden de la planilla de Stretch Inn (0022), con el
// contacto de emergencia (0019) y el email, opcional, al final. En solo lectura el fieldset
// deshabilitado no deja cambiar nada, pero se ve todo.
import type { Alumno } from "@app/contratos";
import { useId } from "react";
import { Campo } from "../../base/controles/Campo.tsx";
import estilos from "./DatosDelAlumno.module.css";
import { ElegirProfe } from "./ElegirProfe.tsx";
import type { Formulario } from "./formulario.ts";

export type CampoDe = (clave: keyof Formulario) => {
  valor: string;
  alCambiar: (valor: string) => void;
};

function Notas({ valor, alCambiar }: { valor: string; alCambiar: (valor: string) => void }) {
  const id = useId();
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        Notas
      </label>
      <textarea
        id={id}
        className={estilos.notas}
        value={valor}
        rows={3}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      />
    </div>
  );
}

function Contacto({ campo }: { campo: CampoDe }) {
  return (
    <>
      <Campo
        etiqueta="Contacto de emergencia"
        opcional
        autoComplete="off"
        ayuda="Nombre y vínculo, por ejemplo: Marta (madre)."
        {...campo("emergenciaNombre")}
      />
      <Campo
        etiqueta="Teléfono de emergencia"
        tipo="tel"
        opcional
        autoComplete="off"
        {...campo("emergenciaTelefono")}
      />
    </>
  );
}

interface Props {
  campo: CampoDe;
  alumno: Alumno | undefined;
  soloLectura: boolean;
}

export function DatosDelAlumno({ campo, alumno, soloLectura }: Props) {
  return (
    <fieldset className={estilos.datos} disabled={soloLectura}>
      <div className={estilos.columnas}>
        <Campo etiqueta="Nombre" autoComplete="off" {...campo("nombre")} />
        <Campo etiqueta="Apellido" autoComplete="off" {...campo("apellido")} />
        <Campo etiqueta="Teléfono" tipo="tel" opcional autoComplete="off" {...campo("telefono")} />
        <Campo etiqueta="Documento" opcional autoComplete="off" {...campo("documento")} />
        <Campo etiqueta="Fecha de nacimiento" tipo="date" opcional {...campo("fechaNacimiento")} />
        <Campo
          etiqueta="Número de socio"
          opcional
          autoComplete="off"
          {...(alumno === undefined ? { ayuda: "Si lo dejás vacío, toma el siguiente." } : {})}
          {...campo("numeroDeSocio")}
        />
        <Campo etiqueta="Fecha de inicio" tipo="date" opcional {...campo("fechaDeInicio")} />
        <ElegirProfe
          {...campo("profeId")}
          nombreActual={alumno?.profeNombre ?? null}
          soloLectura={soloLectura}
        />
        <Contacto campo={campo} />
      </div>
      <Notas {...campo("notas")} />
      <div className={estilos.columnas}>
        <Campo etiqueta="Email" tipo="email" opcional autoComplete="off" {...campo("email")} />
      </div>
    </fieldset>
  );
}
