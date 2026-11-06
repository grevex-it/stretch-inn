// Una cuenta con usuarios en varios centros elige con cuál trabajar (0017).
import { Aviso, mensajeDe } from "../controles/Aviso.tsx";
import { Boton } from "../controles/Boton.tsx";
import { useElegirCentro, useSalir } from "../sesion.ts";
import estilos from "./ElegirCentro.module.css";
import { TarjetaDeAcceso } from "./TarjetaDeAcceso.tsx";

interface Props {
  centros: { id: string; nombre: string }[];
}

export function ElegirCentro({ centros }: Props) {
  const elegir = useElegirCentro();
  const salir = useSalir();
  const error = mensajeDe(elegir.error);

  if (centros.length === 0) {
    return (
      <TarjetaDeAcceso titulo="Sin centros">
        <p>
          Tu cuenta no tiene acceso a ningún centro. Pedile acceso a quien administra tu centro.
        </p>
        <Boton
          variante="secundario"
          alHacerClic={() => {
            salir.mutate();
          }}
        >
          Salir
        </Boton>
      </TarjetaDeAcceso>
    );
  }
  return (
    <TarjetaDeAcceso titulo="¿En qué centro vas a trabajar?" bajada="Después podés cambiarlo.">
      <ul className={estilos.lista}>
        {centros.map((centro) => (
          <li key={centro.id}>
            <Boton
              variante="secundario"
              deshabilitado={elegir.isPending}
              alHacerClic={() => {
                elegir.mutate(centro.id);
              }}
            >
              {centro.nombre}
            </Boton>
          </li>
        ))}
      </ul>
      {error !== undefined && <Aviso tono="error">{error}</Aviso>}
    </TarjetaDeAcceso>
  );
}
