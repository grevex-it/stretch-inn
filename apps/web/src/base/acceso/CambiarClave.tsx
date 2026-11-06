// Clave temporal (0017): hasta cambiarla no se puede usar el panel.
import { useState } from "react";
import { Aviso, mensajeDe } from "../controles/Aviso.tsx";
import { Boton } from "../controles/Boton.tsx";
import { Campo } from "../controles/Campo.tsx";
import { Formulario } from "../controles/Formulario.tsx";
import { useCambiarClave, useSalir } from "../sesion.ts";
import { TarjetaDeAcceso } from "./TarjetaDeAcceso.tsx";

/** Los tres campos y el envío: antes de llamar a la API, que las dos nuevas coincidan. */
function useFormularioDeClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [noCoinciden, setNoCoinciden] = useState(false);
  const cambiar = useCambiarClave();
  return {
    campos: { actual, setActual, nueva, setNueva, repetida, setRepetida },
    enviando: cambiar.isPending,
    error: noCoinciden ? "Las contraseñas nuevas no coinciden." : mensajeDe(cambiar.error),
    enviar: () => {
      setNoCoinciden(nueva !== repetida);
      if (nueva === repetida) cambiar.mutate({ actual, nueva });
    },
  };
}

type Campos = ReturnType<typeof useFormularioDeClave>["campos"];

function CamposDeClave({ campos }: { campos: Campos }) {
  return (
    <>
      <Campo
        etiqueta="Contraseña actual"
        tipo="password"
        valor={campos.actual}
        alCambiar={campos.setActual}
        autoComplete="current-password"
      />
      <Campo
        etiqueta="Contraseña nueva"
        tipo="password"
        valor={campos.nueva}
        alCambiar={campos.setNueva}
        autoComplete="new-password"
        ayuda="Al menos 10 caracteres. Puede ser una frase."
      />
      <Campo
        etiqueta="Repetí la contraseña nueva"
        tipo="password"
        valor={campos.repetida}
        alCambiar={campos.setRepetida}
        autoComplete="new-password"
      />
    </>
  );
}

export function CambiarClave() {
  const { campos, enviando, error, enviar } = useFormularioDeClave();
  const salir = useSalir();
  return (
    <TarjetaDeAcceso
      titulo="Elegí una contraseña nueva"
      bajada="Entraste con una contraseña temporal. Para seguir, cambiala por una tuya."
    >
      <Formulario alEnviar={enviar}>
        <CamposDeClave campos={campos} />
        {error !== undefined && <Aviso tono="error">{error}</Aviso>}
        <Boton tipo="submit" deshabilitado={enviando}>
          Guardar contraseña
        </Boton>
        <Boton
          variante="secundario"
          alHacerClic={() => {
            salir.mutate();
          }}
        >
          Salir
        </Boton>
      </Formulario>
    </TarjetaDeAcceso>
  );
}
