// La clave temporal de un alta o un reset: se muestra una sola vez, para dictarla o copiarla.
import { useId, useState } from "react";
import { Boton } from "../../base/controles/Boton.tsx";
import estilos from "./ClaveTemporal.module.css";

interface Props {
  nombre: string;
  clave: string;
  alCerrar: () => void;
}

export function ClaveTemporal({ nombre, clave, alCerrar }: Props) {
  const titulo = useId();
  const [copiada, setCopiada] = useState(false);
  return (
    <section className={estilos.clave} aria-labelledby={titulo}>
      <h2 id={titulo} className={estilos.titulo}>
        Clave temporal de {nombre}
      </h2>
      <p className={estilos.valor}>{clave}</p>
      <p className={estilos.texto}>
        Pasásela a {nombre}: no la vamos a volver a mostrar. Al entrar, va a tener que elegir una
        contraseña propia.
      </p>
      <div className={estilos.acciones}>
        <Boton
          variante="secundario"
          alHacerClic={() => {
            void navigator.clipboard.writeText(clave).then(() => {
              setCopiada(true);
            });
          }}
        >
          {copiada ? "Copiada" : "Copiar"}
        </Boton>
        <Boton alHacerClic={alCerrar}>Listo</Boton>
      </div>
    </section>
  );
}
