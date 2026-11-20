// Lo que se escribe en la ficha del alumno, todo como texto, y la ficha que se manda a la API.
import type { Alumno, FichaDeAlumno } from "@app/contratos";

export interface Formulario {
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string;
  fechaNacimiento: string;
  numeroDeSocio: string;
  fechaDeInicio: string;
  /** "" es «Sin profe». */
  profeId: string;
  /** Con el vínculo dentro del nombre: «Marta (madre)». */
  emergenciaNombre: string;
  emergenciaTelefono: string;
  notas: string;
  email: string;
}

const VACIO: Formulario = {
  nombre: "",
  apellido: "",
  telefono: "",
  documento: "",
  fechaNacimiento: "",
  numeroDeSocio: "",
  fechaDeInicio: "",
  profeId: "",
  emergenciaNombre: "",
  emergenciaTelefono: "",
  notas: "",
  email: "",
};

export function formularioDe(alumno: Alumno | undefined): Formulario {
  if (alumno === undefined) return VACIO;
  return {
    nombre: alumno.nombre,
    apellido: alumno.apellido,
    telefono: alumno.telefono ?? "",
    documento: alumno.documento ?? "",
    fechaNacimiento: alumno.fechaNacimiento ?? "",
    numeroDeSocio: String(alumno.numeroDeSocio),
    fechaDeInicio: alumno.fechaDeInicio ?? "",
    profeId: alumno.profeId ?? "",
    emergenciaNombre: alumno.emergenciaNombre ?? "",
    emergenciaTelefono: alumno.emergenciaTelefono ?? "",
    notas: alumno.notas,
    email: alumno.email ?? "",
  };
}

/**
 * La ficha para la API, o el mensaje si el número de socio no son solo números (en JSON no hay
 * cómo mandarlo para que la API lo rechace). Sin número no se manda: en el alta lo pone la API
 * (el siguiente del centro) y en la edición queda el que tenía.
 */
export function fichaDe(formulario: Formulario): { ficha: FichaDeAlumno } | { error: string } {
  const { numeroDeSocio, profeId, ...resto } = formulario;
  const numero = numeroDeSocio.trim();
  if (numero !== "" && !/^\d+$/.test(numero)) return { error: "Revisá el número de socio." };
  return {
    ficha: {
      ...resto,
      ...(numero === "" ? {} : { numeroDeSocio: Number(numero) }),
      profeId: profeId === "" ? null : profeId,
    },
  };
}
