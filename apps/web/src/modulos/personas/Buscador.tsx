// Buscador de alumnos: busca al enviar (Enter o el botón), no con cada letra.
import { useState } from "react";
import { Boton } from "../../base/controles/Boton.tsx";
import { Campo } from "../../base/controles/Campo.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import estilos from "./Buscador.module.css";

interface Props {
  conBajas: boolean;
  alBuscar: (texto: string) => void;
  alCambiarBajas: (conBajas: boolean) => void;
}

export function Buscador({ conBajas, alBuscar, alCambiarBajas }: Props) {
  const [texto, setTexto] = useState("");
  return (
    <div className={estilos.buscador}>
      <Formulario
        alEnviar={() => {
          alBuscar(texto.trim());
        }}
      >
        <div className={estilos.fila}>
          <Campo
            etiqueta="Buscar"
            tipo="search"
            opcional
            valor={texto}
            alCambiar={setTexto}
            autoComplete="off"
            ayuda="Nombre, apellido, documento o teléfono."
          />
          <Boton tipo="submit" variante="secundario">
            Buscar
          </Boton>
        </div>
      </Formulario>
      <label className={estilos.bajas}>
        <input
          type="checkbox"
          className={estilos.casilla}
          checked={conBajas}
          onChange={(evento) => {
            alCambiarBajas(evento.target.checked);
          }}
        />
        Mostrar bajas
      </label>
    </div>
  );
}
