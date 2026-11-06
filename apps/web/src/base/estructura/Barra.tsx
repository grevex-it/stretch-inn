// Barra superior: centro y sede con los que se trabaja, y salir (0017). Con un solo centro o una
// sola sede no hay nada que elegir: se muestra el nombre.
import type { EstadoDeSesion } from "@app/contratos";
import logo from "@app/ui/assets/isotipo-crema.png";
import { Boton } from "../controles/Boton.tsx";
import { useElegirCentro, useElegirSede, useSalir } from "../sesion.ts";
import estilos from "./Barra.module.css";
import { Selector } from "./Selector.tsx";

type CentroActivo = NonNullable<EstadoDeSesion["centroActivo"]>;

interface Props {
  centros: EstadoDeSesion["centros"];
  centro: CentroActivo;
}

function SelectorDeSede({ centro }: { centro: CentroActivo }) {
  const elegir = useElegirSede();
  const [unica] = centro.sedes;
  if (centro.sedes.length === 1 && unica !== undefined) {
    return <span className={estilos.nombre}>{unica.nombre}</span>;
  }
  const opciones = [
    { valor: "todas", texto: "Todas mis sedes" },
    ...centro.sedes.map((sede) => ({ valor: sede.id, texto: sede.nombre })),
  ];
  return (
    <Selector
      etiqueta="Sede"
      valor={centro.sedeActiva}
      opciones={opciones}
      deshabilitado={elegir.isPending}
      alCambiar={(sede) => {
        elegir.mutate(sede);
      }}
    />
  );
}

function SelectorDeCentro({ centros, centro }: Props) {
  const elegir = useElegirCentro();
  if (centros.length <= 1) return <span className={estilos.nombre}>{centro.nombre}</span>;
  return (
    <Selector
      etiqueta="Centro"
      valor={centro.id}
      opciones={centros.map((c) => ({ valor: c.id, texto: c.nombre }))}
      deshabilitado={elegir.isPending}
      alCambiar={(centroId) => {
        elegir.mutate(centroId);
      }}
    />
  );
}

export function Barra({ centros, centro }: Props) {
  const salir = useSalir();
  return (
    <header className={estilos.barra}>
      <img className={estilos.logo} src={logo} alt="" />
      <SelectorDeCentro centros={centros} centro={centro} />
      <SelectorDeSede centro={centro} />
      <div className={estilos.salir}>
        <Boton
          variante="secundario"
          alHacerClic={() => {
            salir.mutate();
          }}
        >
          Salir
        </Boton>
      </div>
    </header>
  );
}
