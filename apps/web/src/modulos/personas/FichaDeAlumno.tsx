// Alta, edición y vista de un alumno, con sus antecedentes de salud y sus cuotas. Lo obligatorio:
// nombre, apellido y teléfono. La edición manda la versión que se vio (0013): si alguien la
// cambió en el medio, la API avisa y no se pisa nada. Sin personas.editar se abre en solo lectura.
import type { Alumno, FichaDeAlumno as Ficha } from "@app/contratos";
import { useId, useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import { CuotasDelAlumno } from "../abonos/index.ts";
import { AnularPago } from "../caja/index.ts";
import { useCrearAlumno, useEditarAlumno } from "./consultas.ts";
import { DatosDelAlumno, type CampoDe } from "./DatosDelAlumno.tsx";
import estilos from "./FichaDeAlumno.module.css";
import { fichaDe, formularioDe } from "./formulario.ts";
import { SaludDelAlumno } from "./SaludDelAlumno.tsx";

interface Props {
  /** El alumno a editar o ver, o undefined para sumar uno nuevo. */
  alumno: Alumno | undefined;
  /** Sin personas.editar: se ve la ficha, sin guardar. */
  soloLectura?: boolean;
  /** Después del alta llega el id del alumno nuevo, para dejar su ficha abierta. */
  alGuardar: (nombreCompleto: string, idNuevo?: string) => void;
  alCancelar: () => void;
}

function useGuardar(alumno: Alumno | undefined) {
  const crear = useCrearAlumno();
  const editar = useEditarAlumno();
  const enCurso = alumno === undefined ? crear : editar;
  return {
    enviando: enCurso.isPending,
    error: mensajeDe(enCurso.error),
    guardar: (ficha: Ficha, alTerminar: (idNuevo?: string) => void) => {
      if (alumno === undefined)
        crear.mutate(ficha, {
          onSuccess: ({ id }) => {
            alTerminar(id);
          },
        });
      else
        editar.mutate(
          { ...ficha, id: alumno.id, version: alumno.version },
          {
            onSuccess: () => {
              alTerminar();
            },
          },
        );
    },
  };
}

function tituloDe(alumno: Alumno | undefined, soloLectura: boolean): string {
  if (alumno === undefined) return "Sumar alumno";
  const nombre = `${alumno.nombre} ${alumno.apellido}`;
  return soloLectura ? `Ficha de ${nombre}` : `Editar a ${nombre}`;
}

/** Salud y cuotas: solo de un alumno que ya existe. */
function DelAlumno({ alumno }: { alumno: Alumno | undefined }) {
  if (alumno === undefined) return null;
  return (
    <>
      <SaludDelAlumno alumnoId={alumno.id} />
      <CuotasDelAlumno alumnoId={alumno.id} accion={(cuota) => <AnularPago id={cuota.pagoId} />} />
    </>
  );
}

function Acciones({
  soloLectura,
  enviando,
  alCancelar,
}: {
  soloLectura: boolean;
  enviando: boolean;
  alCancelar: () => void;
}) {
  return (
    <div className={estilos.acciones}>
      {!soloLectura && (
        <Boton tipo="submit" deshabilitado={enviando}>
          Guardar
        </Boton>
      )}
      <Boton variante="secundario" alHacerClic={alCancelar}>
        {soloLectura ? "Cerrar" : "Cancelar"}
      </Boton>
    </div>
  );
}

export function FichaDeAlumno({ alumno, soloLectura = false, alGuardar, alCancelar }: Props) {
  const titulo = useId();
  const [formulario, setFormulario] = useState(() => formularioDe(alumno));
  const [invalido, setInvalido] = useState<string>();
  const { enviando, error, guardar } = useGuardar(alumno);
  const campo: CampoDe = (clave) => ({
    valor: formulario[clave],
    alCambiar: (valor) => {
      setFormulario((actual) => ({ ...actual, [clave]: valor }));
    },
  });
  const enviar = () => {
    if (soloLectura) return;
    const armada = fichaDe(formulario);
    setInvalido("error" in armada ? armada.error : undefined);
    if ("error" in armada) return;
    guardar(armada.ficha, (idNuevo) => {
      alGuardar(`${formulario.nombre.trim()} ${formulario.apellido.trim()}`, idNuevo);
    });
  };
  const mensaje = invalido ?? error;
  return (
    <section className={estilos.ficha} aria-labelledby={titulo}>
      <h2 id={titulo} className={estilos.titulo}>
        {tituloDe(alumno, soloLectura)}
      </h2>
      <Formulario alEnviar={enviar}>
        <DatosDelAlumno campo={campo} alumno={alumno} soloLectura={soloLectura} />
        {mensaje !== undefined && <Aviso tono="error">{mensaje}</Aviso>}
        <Acciones soloLectura={soloLectura} enviando={enviando} alCancelar={alCancelar} />
      </Formulario>
      <DelAlumno alumno={alumno} />
    </section>
  );
}
