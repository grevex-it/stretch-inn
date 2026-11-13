// Alta y edición de un alumno. Lo obligatorio: nombre, apellido y teléfono. La edición manda la
// versión que se vio (0013): si alguien la cambió en el medio, la API avisa y no se pisa nada.
import type { Alumno, FichaDeAlumno as Ficha } from "@app/contratos";
import { useId, useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Campo } from "../../base/controles/Campo.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import { useCrearAlumno, useEditarAlumno } from "./consultas.ts";
import estilos from "./FichaDeAlumno.module.css";

interface Props {
  /** El alumno a editar, o undefined para sumar uno nuevo. */
  alumno: Alumno | undefined;
  alGuardar: (nombreCompleto: string) => void;
  alCancelar: () => void;
}

const VACIA: Ficha = {
  nombre: "",
  apellido: "",
  telefono: "",
  documento: "",
  email: "",
  fechaNacimiento: "",
  notas: "",
};

function fichaDe(alumno: Alumno | undefined): Ficha {
  if (alumno === undefined) return VACIA;
  const { nombre, apellido, notas } = alumno;
  return {
    nombre,
    apellido,
    telefono: alumno.telefono ?? "",
    notas,
    documento: alumno.documento ?? "",
    email: alumno.email ?? "",
    fechaNacimiento: alumno.fechaNacimiento ?? "",
  };
}

function useGuardar(alumno: Alumno | undefined) {
  const crear = useCrearAlumno();
  const editar = useEditarAlumno();
  const enCurso = alumno === undefined ? crear : editar;
  return {
    enviando: enCurso.isPending,
    error: mensajeDe(enCurso.error),
    guardar: (ficha: Ficha, alTerminar: () => void) => {
      if (alumno === undefined) crear.mutate(ficha, { onSuccess: alTerminar });
      else
        editar.mutate(
          { ...ficha, id: alumno.id, version: alumno.version },
          { onSuccess: alTerminar },
        );
    },
  };
}

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

export function FichaDeAlumno({ alumno, alGuardar, alCancelar }: Props) {
  const titulo = useId();
  const [ficha, setFicha] = useState(() => fichaDe(alumno));
  const { enviando, error, guardar } = useGuardar(alumno);
  // El número de socio, la fecha de inicio y el profe todavía no están en el formulario: la API
  // los conserva al editar si no vienen.
  const campo = (clave: Exclude<keyof Ficha, "numeroDeSocio" | "fechaDeInicio" | "profeId">) => ({
    valor: ficha[clave] ?? "",
    alCambiar: (valor: string) => {
      setFicha((actual) => ({ ...actual, [clave]: valor }));
    },
  });
  const enviar = () => {
    guardar(ficha, () => {
      alGuardar(`${ficha.nombre.trim()} ${ficha.apellido.trim()}`);
    });
  };
  return (
    <section className={estilos.ficha} aria-labelledby={titulo}>
      <h2 id={titulo} className={estilos.titulo}>
        {alumno === undefined ? "Sumar alumno" : `Editar a ${alumno.nombre} ${alumno.apellido}`}
      </h2>
      <Formulario alEnviar={enviar}>
        <div className={estilos.columnas}>
          <Campo etiqueta="Nombre" autoComplete="off" {...campo("nombre")} />
          <Campo etiqueta="Apellido" autoComplete="off" {...campo("apellido")} />
          <Campo etiqueta="Teléfono" tipo="tel" autoComplete="off" {...campo("telefono")} />
          <Campo etiqueta="Documento" opcional autoComplete="off" {...campo("documento")} />
          <Campo etiqueta="Email" tipo="email" opcional autoComplete="off" {...campo("email")} />
          <Campo
            etiqueta="Fecha de nacimiento"
            tipo="date"
            opcional
            {...campo("fechaNacimiento")}
          />
        </div>
        <Notas {...campo("notas")} />
        {error !== undefined && <Aviso tono="error">{error}</Aviso>}
        <div className={estilos.acciones}>
          <Boton tipo="submit" deshabilitado={enviando}>
            Guardar
          </Boton>
          <Boton variante="secundario" alHacerClic={alCancelar}>
            Cancelar
          </Boton>
        </div>
      </Formulario>
    </section>
  );
}
